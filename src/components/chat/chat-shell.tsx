import React from 'react'
import { MessageSquare, User, Globe } from 'lucide-react'
import type { WorldSlice } from '@/domain/world'
import { ChatInput } from './chat-input'
import { MessageList } from './message-list'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ChatResponse = {
  reply: string
  worldSummary: string
  world?: WorldSlice
  error?: string
}

type AgentChatResponse = {
  reply: string
  agentName: string
  agentSeed: string
  error?: string
}

type ChatShellProps = {
  world?: WorldSlice | null
  onWorldUpdate?: (world: WorldSlice) => void
}

export function ChatShell({ world, onWorldUpdate }: ChatShellProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [summary, setSummary] = React.useState<string>('')
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [selectedAgent, setSelectedAgent] = React.useState<string | null>(null)

  const handleSubmit = async () => {
    if (!input.trim() || loading) return
    const content = input.trim()
    setMessages((prev) => [...prev, { role: 'user', content }])
    setInput('')
    setLoading(true)

    try {
      if (selectedAgent) {
        // Agent chat mode
        const response = await fetch('/api/agent-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, agentSeed: selectedAgent, world: world ?? undefined }),
        })
        const data: AgentChatResponse = await response.json()

        if (data.error) {
          setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${data.error}` }])
        } else {
          setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
          setSummary(`Talking with ${data.agentName}`)
        }
      } else {
        // World event mode
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, world: world ?? undefined }),
        })
        const data: ChatResponse = await response.json()

        if (data.error) {
          setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${data.error}` }])
        } else {
          setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
          setSummary(data.worldSummary)
          if (data.world && onWorldUpdate) {
            onWorldUpdate(data.world)
          }
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${(error as Error).message}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  const aliveAgents = world?.agents.npcs.filter(a => a.life_status === 'alive') || []

  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Chat</h2>
        </div>

        {/* Agent selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedAgent(null)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              selectedAgent === null
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            World
          </button>

          {aliveAgents.length > 0 && (
            <select
              value={selectedAgent || ''}
              onChange={(e) => setSelectedAgent(e.target.value || null)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select Agent</option>
              {aliveAgents.map((agent) => (
                <option key={agent.genetics.seed} value={agent.genetics.seed}>
                  {agent.identity.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <MessageList messages={messages} />
      </div>

      <div className="border-t border-slate-200 p-3">
        <ChatInput value={input} onChange={setInput} onSubmit={handleSubmit} disabled={loading} />
      </div>

      {summary ? (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-medium text-slate-500">
            {selectedAgent ? 'Agent:' : 'World Summary:'}
          </span>{' '}
          {summary}
        </div>
      ) : null}
    </section>
  )
}
