import React from 'react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type MessageListProps = {
  messages: ChatMessage[]
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="space-y-3">
      {messages.map((message, index) => (
        <div key={`${message.role}-${index}`} className="rounded border p-3">
          <div className="text-xs uppercase text-slate-500">{message.role}</div>
          <div className="mt-1">{message.content}</div>
        </div>
      ))}
    </div>
  )
}
