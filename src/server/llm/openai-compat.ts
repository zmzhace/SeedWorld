import 'server-only'

import OpenAI from 'openai'

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

export function getOpenAIClient(): OpenAI {
  const { apiKey, baseURL } = llmConfig()
  const fingerprint = `${apiKey}:${baseURL}`
  if (!cachedClient || cachedFingerprint !== fingerprint) {
    cachedClient = new OpenAI({ apiKey, baseURL, timeout: 300_000, maxRetries: 2 })
    cachedFingerprint = fingerprint
  }
  return cachedClient
}

export function getModel(): string {
  return llmConfig().model
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

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let completion: Awaited<ReturnType<OpenAI['chat']['completions']['create']>>
    // JSON-mode capability negotiation is separate from content regeneration:
    // an explicit response_format rejection adds one request but never
    // consumes a content attempt.
    for (;;) {
      try {
        completion = await client.chat.completions.create({
          model,
          messages,
          temperature: options.temperature ?? 0.3,
          ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
          ...(responseFormat ? { response_format: responseFormat } : {}),
        })
        break
      } catch (error) {
        if (responseFormat && isResponseFormatUnsupported(error)) {
          responseFormat = undefined
          continue
        }
        throw error
      }
    }
    const choice = completion.choices[0]
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
      if (!(error instanceof LLMResponseError) || attempt >= attempts) throw error
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
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const client = getOpenAIClient()
  const model = getModel()
  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    ...(options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens }),
  })
  return cleanChatText(completion.choices[0]?.message?.content ?? '')
}
