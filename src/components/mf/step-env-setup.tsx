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
  onAgentsChanged?: () => void
}

export function StepEnvSetup({ world, agents, logs, confirming, onConfirmVisibility, onNextStep, onGoBack, onAgentsChanged }: Props) {
  const [syncState, setSyncState] = React.useState<'idle' | 'syncing' | 'ready' | 'error'>('idle')
  const [syncMsg, setSyncMsg] = React.useState('')
  const syncedWorldRef = React.useRef<string | null>(null)

  const syncAgents = React.useCallback(async () => {
    if (syncState === 'syncing' || !world?.id) return
    setSyncState('syncing')
    setSyncMsg('正在从世界档案识别可行动个体…')
    try {
      const response = await fetch(`/api/worlds/${world.id}/agents/sync`, {
        method: 'POST',
      })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '行动者建立失败')
      setSyncState('ready')
      setSyncMsg(
        value.added || value.removed
          ? `已建立 ${value.candidateEntityCount} 位行动者，并修正 ${value.removed} 个误识别对象`
          : `已自动建立 ${value.candidateEntityCount} 位行动者`,
      )
      await onAgentsChanged?.()
    } catch (cause) {
      setSyncState('error')
      setSyncMsg(`自动建立失败：${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }, [onAgentsChanged, syncState, world?.id])

  React.useEffect(() => {
    if (!world?.id || world.archiveStatus !== 'ready' || syncedWorldRef.current === world.id) return
    syncedWorldRef.current = world.id
    void syncAgents()
  }, [syncAgents, world?.archiveStatus, world?.id])

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
              <span className="step-title">秘密与角色认知</span>
            </div>
            <div className="step-status">
              {confirmed ? <span className="badge success">已确认</span> : <span className="badge processing">待确认</span>}
            </div>
          </div>
          <div className="card-content">
            <p className="api-note">OBJECTIVE / PUBLIC NARRATIVE / CHARACTER BELIEF</p>
            <p className="description">
              确认角色只能读取公开叙事、自身经历与个人信念。客观真相和未曝光秘密默认隔离；确认后原始资料保持只读。
            </p>
            {!confirmed ? (
              <button className="action-btn" disabled={confirming} onClick={onConfirmVisibility}>
                {confirming && <span className="spinner-sm"></span>}
                {confirming ? '正在确认……' : '确认认知边界 ➝'}
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
            <p className="api-note">ACTIONABLE ENTITIES / AUTOMATIC MATERIALIZATION</p>
            <p className="description">系统会自动把资料中的可行动个体建立为角色智能体。组织、地点、规则、事件和概念只保留在世界档案中，不会被误当成人物。</p>
            <div className={`agent-sync-state ${syncState}`} role="status" aria-live="polite">
              {syncState === 'syncing' && <span className="spinner-sm" aria-hidden="true" />}
              <strong>{syncState === 'error' ? '需要重试' : syncState === 'ready' ? '行动者已就绪' : '等待资料编译'}</strong>
              <span>{syncMsg || '资料编译完成后会自动执行，无需手动生成人物。'}</span>
              {syncState === 'error' && (
                <button className="action-btn secondary" type="button" onClick={() => void syncAgents()}>
                  重试自动建立
                </button>
              )}
            </div>
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
              <p className="description">尚未识别到可行动个体。系统会在资料编译完成后自动重试；若资料只有规则或地点，请先补充人物资料。</p>
            )}
          </div>
        </div>

        <div className="step-card">
          <div className="card-header">
            <div className="step-info">
              <span className="step-num">03</span>
              <span className="step-title">返回创作台</span>
            </div>
          </div>
          <div className="card-content">
            <p className="api-note">NEXT / SIMULATION LEDGER</p>
            <p className="description">生成下一章时，角色意图、编剧会与正文审稿会连续执行；只有正文通过后，结果才会写入正式世界。</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="action-btn secondary" onClick={onGoBack}>
                ← 上一步
              </button>
              <button className="action-btn" disabled={!confirmed || syncState !== 'ready' || actionable.length === 0} onClick={onNextStep}>
                前往创作台 ➝
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
