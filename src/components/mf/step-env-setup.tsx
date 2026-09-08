'use client'

import React from 'react'
import './mf-workbench.css'

type Props = {
  world: any
  agents: any[]
  logs: Array<{ time: string; msg: string }>
  confirming: boolean
  onConfirmVisibility: () => void
  onNextStep: () => void
  onGoBack: () => void
}

export function StepEnvSetup({ world, agents, logs, confirming, onConfirmVisibility, onNextStep, onGoBack }: Props) {
  const logRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs.length])

  const confirmed = Boolean(world?.visibilityConfirmed)
  const actionable = agents.filter((a) => a)

  return (
    <div className="mf-workbench workbench-panel">
      <div className="scroll-container">
        <div className={`step-card${!confirmed ? ' active' : ' completed'}`}>
          <div className="card-header">
            <div className="step-info">
              <span className="step-num">01</span>
              <span className="step-title">知识层确认</span>
            </div>
            <div className="step-status">
              {confirmed ? <span className="badge success">已确认</span> : <span className="badge processing">待确认</span>}
            </div>
          </div>
          <div className="card-content">
            <p className="api-note">OBJECTIVE · PUBLIC NARRATIVE · CHARACTER BELIEF</p>
            <p className="description">
              确认角色只能读取公开叙事、自身经历与个人信念。客观真相和未曝光秘密默认隔离；确认后原始资料固定为只读 Source Graph。
            </p>
            {!confirmed ? (
              <button className="action-btn" disabled={confirming} onClick={onConfirmVisibility}>
                {confirming && <span className="spinner-sm"></span>}
                {confirming ? '正在确认……' : '确认知识边界 ➝'}
              </button>
            ) : (
              <p className="description">可见性已确认，推演智能体将按隔离规则获取知识。</p>
            )}
          </div>
        </div>

        <div className={`step-card${confirmed ? ' active' : ''}`}>
          <div className="card-header">
            <div className="step-info">
              <span className="step-num">02</span>
              <span className="step-title">可行动角色</span>
            </div>
            <div className="step-status">
              <span className="badge pending">{actionable.length} 位</span>
            </div>
          </div>
          <div className="card-content">
            <p className="api-note">ACTIONABLE ENTITIES → AGENTS</p>
            <p className="description">只有能够主动选择与行动的实体才会成为 Agent；地点、规则、事件和概念仍保留在图谱中，不会被拟人化。</p>
            {actionable.length > 0 ? (
              <div className="tags-container">
                <span className="tag-label">AGENTS</span>
                <div className="tags-list">
                  {actionable.map((agent: any, i: number) => (
                    <span key={agent.genetics?.seed || agent.id || i} className="entity-tag">
                      {agent.identity?.name || agent.name || `Agent ${i + 1}`}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="description">暂无智能体。先完成图谱抽取（可行动类型会自动同步）。</p>
            )}
          </div>
        </div>

        <div className="step-card">
          <div className="card-header">
            <div className="step-info">
              <span className="step-num">03</span>
              <span className="step-title">解锁事件推演</span>
            </div>
          </div>
          <div className="card-content">
            <p className="api-note">NEXT · SIMULATION LEDGER</p>
            <p className="description">推演不会直接改写原设定。每轮的角色意图先由规则裁决，成立的结果才会作为增量事实写入 Evolution Graph。</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="action-btn" onClick={onGoBack} style={{ background: '#FFF', color: '#333', border: '1px solid #E0E0E0' }}>
                ← 上一步
              </button>
              <button className="action-btn" disabled={!confirmed} onClick={onNextStep}>
                进入推演 ➝
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
