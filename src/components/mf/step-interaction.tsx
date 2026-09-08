'use client'

import React from 'react'
import './mf-workbench.css'

type Props = {
  world: any
  snapshot: any
  logs: Array<{ time: string; msg: string }>
  onLog: (msg: string) => void
  onWorldUpdate?: (world: any) => void
}

type Message = { role: 'user' | 'world'; text: string }

export function StepInteraction({ world, snapshot, logs, onLog, onWorldUpdate }: Props) {
  const [input, setInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [messages, setMessages] = React.useState<Message[]>([])
  const logRef = React.useRef<HTMLDivElement>(null)
  const chatRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs.length])
  React.useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages.length])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    if (!snapshot) {
      onLog('chat failed: 世界快照不存在')
      return
    }
    setInput('')
    setMessages((current) => [...current, { role: 'user', text }])
    setBusy(true)
    try {
      onLog(`world event injected: ${text.slice(0, 60)}`)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, world: snapshot }),
      })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || value.detail || '对话失败')
      const reply =
        value.reply || value.message || value.event || JSON.stringify(value).slice(0, 500)
      setMessages((current) => [...current, { role: 'world', text: String(reply) }])
      if (value.world) {
        localStorage.setItem(`world_${world.id}`, JSON.stringify(value.world))
        onWorldUpdate?.(value.world)
      }
      onLog('干预事件已进入世界，并完成一轮反应')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setMessages((current) => [...current, { role: 'world', text: `（失败）${message}` }])
      onLog(`chat failed: ${message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mf-workbench workbench-panel">
      <div className="scroll-container">
        <div className="step-card active">
          <div className="card-header">
            <div className="step-info">
              <span className="step-num">01</span>
              <span className="step-title">导演干预</span>
            </div>
            <div className="step-status">
              {busy ? <span className="badge processing">回应中</span> : <span className="badge pending">待机</span>}
            </div>
          </div>
          <div className="card-content">
            <p className="api-note">DIRECTOR INPUT · EXTERNAL EVENT</p>
            <p className="description">
              这不是和角色聊天。你可以投入一个外部变量（地震、陌生来客、密令），系统会先解释成客观事件，再让角色按现有知识与立场反应。
            </p>
            <div
              ref={chatRef}
              style={{
                border: '1px solid #EAEAEA',
                borderRadius: 4,
                minHeight: 220,
                maxHeight: 380,
                overflowY: 'auto',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                background: '#FAFAFA',
                marginBottom: 12,
              }}
            >
              {messages.length === 0 && (
                <p className="description" style={{ margin: 0 }}>
                  还没有导演干预。只在你需要测试世界承压方式时，再投入一个外部事件。
                </p>
              )}
              {messages.map((message, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    background: message.role === 'user' ? '#000' : '#FFF',
                    color: message.role === 'user' ? '#FFF' : '#333',
                    border: message.role === 'user' ? 'none' : '1px solid #EAEAEA',
                    borderRadius: 4,
                    padding: '8px 12px',
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {message.text}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void send()}
                placeholder="例如：城内所有能量计同时归零……"
                disabled={busy}
                style={{ flex: 1, border: '1px solid #E0E0E0', borderRadius: 4, padding: '10px 12px', fontSize: 13 }}
              />
              <button className="action-btn" disabled={busy || !input.trim()} onClick={() => void send()}>
                {busy && <span className="spinner-sm"></span>}
                投入事件 ➝
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="system-logs">
        <div className="log-header">
          <span className="log-title">SYSTEM DASHBOARD</span>
          <span className="log-id">{world?.id?.slice(0, 8) || 'NO_WORLD'}</span>
        </div>
        <div className="log-content" ref={logRef}>
          {logs.map((log, idx) => (
            <div className="log-line" key={idx}>
              <span className="log-time">{log.time}</span>
              <span className="log-msg">{log.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
