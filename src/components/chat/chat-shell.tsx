import React from 'react'
import { ChatInput } from './chat-input'
import { MessageList } from './message-list'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ChatResponse = {
  reply: string
  worldSummary: string
}

export function ChatShell() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [summary, setSummary] = React.useState<string>('')
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async () => {
    if (!input.trim() || loading) return
    const content = input.trim()
    setMessages((prev) => [...prev, { role: 'user', content }])
    setInput('')
    setLoading(true)

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content }),
    })
    const data: ChatResponse = await response.json()

    setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    setSummary(data.worldSummary)
    setLoading(false)
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Chat</h2>
      <MessageList messages={messages} />
      <ChatInput value={input} onChange={setInput} onSubmit={handleSubmit} disabled={loading} />
      {summary ? <div className="rounded border p-3">World Summary: {summary}</div> : null}
    </section>
  )
}
