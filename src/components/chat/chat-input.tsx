import React from 'react'

type ChatInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
}

export function ChatInput({ value, onChange, onSubmit, disabled }: ChatInputProps) {
  return (
    <div className="flex gap-2">
      <input
        className="flex-1 rounded border px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Say something..."
      />
      <button
        className="rounded bg-black px-3 py-2 text-white"
        onClick={onSubmit}
        disabled={disabled}
      >
        Send
      </button>
    </div>
  )
}
