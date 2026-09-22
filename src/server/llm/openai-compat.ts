import 'server-only'

import OpenAI from 'openai'
import { ProxyAgent, fetch as undiciFetch } from 'undici'

/**
 * OpenAI-compatible LLM client.
 *
 * Engineering ported from MiroFish `backend/app/utils/llm_client.py`:
 * - single chat-completions entry point. Unlike the Anthropic SDK (which
 *   appends `/v1/messages` to the base URL), the OpenAI SDK appends
 *   `/chat/completions`, so providers such as Qianfan work without a
 *   provider-specific SDK.
 * - `json_object` response_format with capability negotiation (one extra
 *   request when the provider explicitly rejects it, never counted as a
 *   content attempt).
 * - `<think>` + fence cleaning, tolerant single-object JSON parse, bounded
 *   content retries with the token cap lifted on retry.
 */

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class LLMResponseError extends Error {
  finishReason: string | null
  constructor(message: string, finishReason: string | null = null) {
    super(message)
    this.name = 'LLMResponseError'
    this.finishReason = finishReason
  }
}

export function llmConfig() {
  const apiKey = (process.env.WORLD_SLICE_API_KEY || '').trim()
  const baseURL = (process.env.WORLD_SLICE_API_BASE || 'https://qianfan.baidubce.com/v2').trim()
  const model = (process.env.WORLD_SLICE_MODEL || '').trim()
  if (!apiKey) throw new Error('WORLD_SLICE_API_KEY 未配置')
  if (!model) throw new Error('WORLD_SLICE_MODEL 未配置')
  return { apiKey, baseURL, model }
}

let cachedClient: OpenAI | null = null
let cachedFingerprint = ''
let cachedProxyAgent: ProxyAgent | null = null
let cachedProxyUrl = ''

export function getOpenAIClient(): OpenAI {
  const { apiKey, baseURL } = llmConfig()
  const configuredTimeout = Number(process.env.WORLD_SLICE_LLM_TIMEOUT_MS || 180_000)
  const timeout = Number.isFinite(configuredTimeout)
    ? Math.max(30_000, Math.min(configuredTimeout, 300_000))
    : 180_000
  const proxyUrl = (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '').trim()
  const fingerprint = `${apiKey}:${baseURL}:${timeout}:${proxyUrl}`
  if (!cachedClient || cachedFingerprint !== fingerprint) {
    // chatJson owns the bounded semantic retry policy. Letting the SDK retry
    // each request again can turn one failed workflow step into a 15-minute
    // black box, which makes long-form generation effectively unrecoverable.
    if (proxyUrl && (!cachedProxyAgent || cachedProxyUrl !== proxyUrl)) {
      cachedProxyAgent?.close().catch(() => undefined)
      cachedProxyAgent = new ProxyAgent(proxyUrl)
      cachedProxyUrl = proxyUrl
    }
    const proxyFetch = proxyUrl && cachedProxyAgent
      ? ((input: Parameters<typeof undiciFetch>[0], init?: Parameters<typeof undiciFetch>[1]) => undiciFetch(input, { ...init, dispatcher: cachedProxyAgent! }))
      : undefined
    cachedClient = new OpenAI({ apiKey, baseURL, timeout, maxRetries: 0, ...(proxyFetch ? { fetch: proxyFetch as unknown as typeof globalThis.fetch } : {}) })
    cachedFingerprint = fingerprint
  }
  return cachedClient
}

export function getModel(): string {
  return llmConfig().model
}

function providerReasoningOptions(): Record<string, unknown> {
  const { baseURL, model } = llmConfig()
  // OpenRouter's free router may select a reasoning model that spends the
  // entire completion budget on hidden reasoning and returns null content.
  // Keep reasoning available for planning, but cap it to a low effort and do
  // not ask the gateway to echo the trace back to the application.
  // Do not force reasoning off on the free router. It can select endpoints
  // where reasoning is mandatory; omitting this option lets the selected
  // provider apply its own compatible default.
  if (baseURL.includes('openrouter.ai') && model !== 'openrouter/free') {
    return { reasoning: { effort: 'none', exclude: true } }
  }
  return {}
}

export function cleanChatText(content: string): string {
  let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  cleaned = cleaned.replace(/^﻿/, '')
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '')
  cleaned = cleaned.replace(/\n?```\s*$/, '')
  return cleaned.trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Brace-aware scan for the first complete top-level JSON object. */
function extractFirstJsonObject(content: string): { value: unknown; end: number } {
  const start = content.indexOf('{')
  if (start === -1) throw new LLMResponseError('LLM did not produce a JSON response')
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < content.length; i++) {
    const ch = content[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return { value: JSON.parse(content.slice(start, i + 1)), end: i + 1 }
      }
    }
  }
  throw new LLMResponseError('LLM returned unbalanced JSON')
}

function trailingHasJsonContainer(trailing: string): boolean {
  for (let i = 0; i < trailing.length; i++) {
    const ch = trailing[i]
    if (ch !== '{' && ch !== '[') continue
    try {
      const value = JSON.parse(trailing.slice(i))
      if (typeof value === 'object' && value !== null) return true
    } catch {
      // remainder is not exactly one JSON value; keep scanning
    }
  }
  return false
}

function parseJsonResponse(content: string, finishReason: string | null): Record<string, unknown> {
  const cleaned = cleanChatText(content)
  if (!cleaned) throw new LLMResponseError('LLM returned empty JSON content', finishReason)
  try {
    const value: unknown = JSON.parse(cleaned)
    if (!isRecord(value)) throw new LLMResponseError('LLM JSON response must be a top-level object', finishReason)
    return value
  } catch (strictError) {
    // Some compatible providers append a short explanation after an otherwise
    // complete JSON object. Accept one object decoded from the beginning.
    let extracted: { value: unknown; end: number }
    try {
      extracted = extractFirstJsonObject(cleaned)
    } catch {
      throw new LLMResponseError(
        `LLM returned invalid JSON (${(strictError as Error).message})`,
        finishReason,
      )
    }
    if (!isRecord(extracted.value)) {
      throw new LLMResponseError('LLM JSON response must be a top-level object', finishReason)
    }
    const trailing = cleaned.slice(extracted.end).trim()
    if (trailing && trailingHasJsonContainer(trailing)) {
      throw new LLMResponseError('LLM returned multiple JSON values', finishReason)
    }
    return extracted.value
  }
}

function isResponseFormatUnsupported(error: unknown): boolean {
  const status =
    (error as { status?: number })?.status ?? (error as { statusCode?: number })?.statusCode
  if (status !== 400 && status !== 422) return false
  const body = (error as { body?: unknown })?.body ?? (error as { error?: unknown })?.error
  const details = (body as { error?: Record<string, unknown> })?.error ?? body
  if (typeof details !== 'object' || details === null) return false
  const record = details as Record<string, unknown>
  const param = String(record.param || '').trim().toLowerCase()
  if (param === 'response_format' || param.startsWith('response_format.')) return true
  const message = String(record.message || (error as Error)?.message || '').toLowerCase()
  if (!message.includes('response_format')) return false
  const code = String(record.code || '').toLowerCase()
  const unsupportedCodes = new Set([
    'unsupported_parameter',
    'unsupported_value',
    'unknown_parameter',
    'invalid_parameter',
  ])
  const unsupportedPhrases = ['not support', 'unsupported', 'unknown parameter', 'unrecognized parameter']
  return unsupportedCodes.has(code) || unsupportedPhrases.some((phrase) => message.includes(phrase))
}

function providerError(error: unknown): Error {
  const status = Number((error as { status?: number })?.status || (error as { statusCode?: number })?.statusCode || 0)
  const message = error instanceof Error ? error.message : String(error)
  if (status === 403) return new Error(`模型服务拒绝访问（403）：${message}`)
  if (status === 429) {
    const body = (error as { body?: unknown })?.body ?? (error as { error?: unknown })?.error
    const metadata = (body as { metadata?: { headers?: Record<string, unknown> } })?.metadata
    const reset = Number(metadata?.headers?.['X-RateLimit-Reset'] || metadata?.headers?.['x-ratelimit-reset'] || 0)
    const resetHint = Number.isFinite(reset) && reset > Date.now() ? `；免费额度预计于 ${new Date(reset).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} 重置` : ''
    return new Error(`模型服务触发限流（429），请稍后局部重试${resetHint}：${message}`)
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(message)) return new Error(`模型服务超时：${message}`)
  return error instanceof Error ? error : new Error(message)
}

function isTransientProviderError(error: unknown): boolean {
  const status = Number((error as { status?: number })?.status || (error as { statusCode?: number })?.statusCode || 0)
  const message = error instanceof Error ? error.message : String(error)
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500 ||
    /connection|terminated|timeout|timed out|econnreset|socket|temporarily overloaded|service unavailable|upstream error/i.test(message)
}

async function waitBeforeRetry(attempt: number): Promise<void> {
  const delay = Math.min(1500 * 2 ** Math.max(0, attempt - 1), 6000)
  await new Promise((resolve) => setTimeout(resolve, delay))
}

async function repairJsonOnce(client: OpenAI, model: string, invalid: string, maxTokens?: number): Promise<Record<string, unknown>> {
  const params = {
      model,
      messages: [
        { role: 'system' as const, content: '你是 JSON 格式修复器。只能修复括号、引号、逗号、转义和截断造成的格式错误；不得改变字段含义，不得增加原文没有的事实。只输出一个 JSON 对象。' },
        { role: 'user' as const, content: invalid },
      ],
      temperature: 0,
      max_tokens: Math.min(Math.max(maxTokens || 4096, 4096), 32768),
      ...providerReasoningOptions(),
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
  // Deliberately omit response_format here. This repair path must also work
  // with free gateways that rejected JSON mode in the original request.
  let completion
  try { completion = await client.chat.completions.create(params) }
  catch (error) { throw providerError(error) }
  const choice = completion.choices?.[0]
  if (!choice || choice.finish_reason === 'length') throw new LLMResponseError('JSON 修复输出仍被截断', choice?.finish_reason || null)
  return parseJsonResponse(choice.message.content || '', choice.finish_reason || null)
}

export async function chatJson(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number | null; maxAttempts?: number } = {},
): Promise<Record<string, unknown>> {
  const client = getOpenAIClient()
  const model = getModel()
  const attempts = Math.max(1, options.maxAttempts ?? 2)
  let responseFormat: { type: 'json_object' } | undefined = { type: 'json_object' }
  let maxTokens = options.maxTokens === null ? undefined : (options.maxTokens ?? undefined)
  let lastError: LLMResponseError | null = null

  attemptLoop: for (let attempt = 1; attempt <= attempts; attempt++) {
    let completion: { choices: Array<{ finish_reason: string | null; message: { content: string | null } }> }
    // JSON-mode capability negotiation is separate from content regeneration:
    // an explicit response_format rejection adds one request but never
    // consumes a content attempt.
    for (;;) {
      try {
        const stream = await client.chat.completions.create({
          model,
          messages,
          temperature: options.temperature ?? 0.3,
          ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
          ...(responseFormat ? { response_format: responseFormat } : {}),
          stream: true,
          ...providerReasoningOptions(),
        } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming)
        let content = ''
        let finishReason: string | null = null
        for await (const chunk of stream) {
          const choice = chunk.choices?.[0]
          if (!choice) continue
          content += choice.delta?.content ?? ''
          if (choice.finish_reason) finishReason = choice.finish_reason
        }
        completion = { choices: [{ finish_reason: finishReason, message: { content } }] }
        break
      } catch (error) {
        if (responseFormat && isResponseFormatUnsupported(error)) {
          responseFormat = undefined
          continue
        }
        const normalized = providerError(error)
        if (attempt < attempts && isTransientProviderError(error)) {
          await waitBeforeRetry(attempt)
          continue attemptLoop
        }
        throw normalized
      }
    }
    const choice = completion.choices?.[0]
    if (!choice) throw new LLMResponseError('LLM returned no choices')
    try {
      if (choice.finish_reason === 'length') {
        throw new LLMResponseError('LLM JSON output was truncated at the token limit', 'length')
      }
      if (choice.finish_reason && choice.finish_reason !== 'stop') {
        throw new LLMResponseError(
          `LLM JSON generation stopped unexpectedly (${choice.finish_reason})`,
          choice.finish_reason,
        )
      }
      return parseJsonResponse(choice.message.content ?? '', choice.finish_reason ?? null)
    } catch (error) {
      if (!(error instanceof LLMResponseError)) throw error
      if (attempt >= attempts) {
        try { return await repairJsonOnce(client, model, choice.message.content ?? '', maxTokens) }
        catch (repairError) { throw new LLMResponseError(`模型连续返回非法 JSON：${repairError instanceof Error ? repairError.message : String(repairError)}`, choice.finish_reason ?? null) }
      }
      lastError = error
      // A caller-supplied cap is the common cause of a partial JSON object.
      // Double it (bounded) for the retry: some gateways pre-check credit
      // coverage against max_tokens, so an uncapped retry can 402.
      if (error.finishReason === 'length' && maxTokens !== undefined) {
        maxTokens = Math.min(maxTokens * 2, 32768)
      }
    }
  }
  throw lastError ?? new LLMResponseError('LLM did not produce a JSON response')
}

export async function chatText(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number; maxAttempts?: number } = {},
): Promise<string> {
  const client = getOpenAIClient()
  const model = getModel()
  const attempts = Math.max(1, options.maxAttempts ?? 2)
  let lastError: Error | undefined
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      // Long prose responses from free OpenRouter routes are more reliable as
      // a stream: each chunk keeps the connection active instead of leaving
      // one silent HTTP request open until the entire chapter is finished.
      const stream = await client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        ...(options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens }),
        stream: true,
        ...providerReasoningOptions(),
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming)
      let raw = ''
      let finishReason: string | null = null
      for await (const chunk of stream) {
        const choice = chunk.choices?.[0]
        if (!choice) continue
        raw += choice.delta?.content ?? ''
        if (choice.finish_reason) finishReason = choice.finish_reason
      }
      if (finishReason === 'length') throw new LLMResponseError('LLM prose output was truncated at the token limit', 'length')
      const content = cleanChatText(raw)
      if (!content) throw new LLMResponseError('LLM returned empty prose content', finishReason)
      return content
    } catch (error) {
      lastError = providerError(error)
      if (attempt >= attempts) throw lastError
      if (!isTransientProviderError(error) && !(error instanceof LLMResponseError)) throw lastError
      await waitBeforeRetry(attempt)
    }
  }
  throw lastError ?? new LLMResponseError('LLM did not produce prose')
}
