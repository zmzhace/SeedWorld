'use client'

import React from 'react'
import './mf-workbench.css'

type Props = {
  world: any
  ontology: any
  job: any
  graphStats: { nodes: number; edges: number; types: number }
  logs: Array<{ time: string; msg: string }>
  starting: boolean
  onStartExtraction: () => void
  onNextStep: () => void
}

export function StepGraphBuild({ world, ontology, job, graphStats, logs, starting, onStartExtraction, onNextStep }: Props) {
  const [selected, setSelected] = React.useState<any>(null)
  const logRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs.length])

  const phase = world?.graphSyncStatus === 'ready' ? 2 : world?.graphSyncStatus === 'processing' ? 1 : 0
  const entityTypes: any[] = ontology?.entityTypes || []
  const relationTypes: any[] = ontology?.relationTypes || []

  return (
    <div className="mf-workbench workbench-panel">
      <div className="scroll-container">
        <div className={`step-card${phase === 0 ? ' active' : ''}${phase > 0 ? ' completed' : ''}`}>
          <div className="card-header">
            <div className="step-info">
              <span className="step-num">01</span>
              <span className="step-title">本体生成</span>
            </div>
            <div className="step-status">
              {phase > 0 ? (
                <span className="badge success">已完成</span>
              ) : phase === 0 ? (
                <span className="badge processing">{job && !['completed', 'failed'].includes(job.status) ? '生成中' : '待启动'}</span>
              ) : (
                <span className="badge pending">等待中</span>
              )}
            </div>
          </div>

          <div className="card-content">
            <p className="api-note">SOURCE MATERIAL → DYNAMIC ONTOLOGY</p>
            <p className="description">分析原始资料，只为这一部作品生成本体。平台不预设异能、势力或秘密等题材类型。</p>

              {phase === 0 && job && !['completed', 'failed'].includes(job.status) && (
              <div className="progress-section">
                <div className="spinner-sm"></div>
                <span>{job.message || '正在分析资料…'}</span>
              </div>
            )}
            {phase === 0 && (!job || ['failed'].includes(job.status)) && (
              <div className="progress-section">
                <button className="action-btn" disabled={starting} onClick={onStartExtraction}>
                  {starting && <span className="spinner-sm"></span>}
                  {starting ? '启动中' : '开始抽取 ➝'}
                </button>
              </div>
            )}

            {selected && (
              <div className="ontology-detail-overlay">
                <div className="detail-header">
                  <div className="detail-title-group">
                    <span className="detail-type-badge">{selected.itemType === 'entity' ? 'ENTITY' : 'RELATION'}</span>
                    <span className="detail-name">{selected.name}</span>
                  </div>
                  <button className="close-btn" onClick={() => setSelected(null)}>
                    ×
                  </button>
                </div>
                <div className="detail-body">
                  <div className="detail-desc">{selected.description}</div>
                  {selected.fields?.length > 0 && (
                    <div className="detail-section">
                      <span className="section-label">ATTRIBUTES</span>
                      <div className="attr-list">
                        {selected.fields.map((attr: any) => (
                          <div key={attr.name} className="attr-item">
                            <span className="attr-name">{attr.name}</span>
                            <span className="attr-type">({attr.type})</span>
                            <span className="attr-desc">{attr.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selected.sourceTargets?.length > 0 && (
                    <div className="detail-section">
                      <span className="section-label">CONNECTIONS</span>
                      <div className="conn-list">
                        {selected.sourceTargets.map((conn: any, idx: number) => (
                          <div key={idx} className="conn-item">
                            <span className="conn-node">{conn.source}</span>
                            <span className="conn-arrow">→</span>
                            <span className="conn-node">{conn.target}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {entityTypes.length > 0 && (
              <div className={`tags-container${selected ? ' dimmed' : ''}`}>
                <span className="tag-label">GENERATED ENTITY TYPES</span>
                <div className="tags-list">
                  {entityTypes.map((entity: any) => (
                    <span key={entity.name} className="entity-tag clickable" onClick={() => setSelected({ ...entity, itemType: 'entity' })}>
                      {entity.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {relationTypes.length > 0 && (
              <div className={`tags-container${selected ? ' dimmed' : ''}`}>
                <span className="tag-label">GENERATED RELATION TYPES</span>
                <div className="tags-list">
                  {relationTypes.map((rel: any) => (
                    <span key={rel.name} className="entity-tag clickable" onClick={() => setSelected({ ...rel, itemType: 'relation' })}>
                      {rel.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`step-card${phase === 1 ? ' active' : ''}${phase > 1 ? ' completed' : ''}`}>
          <div className="card-header">
            <div className="step-info">
              <span className="step-num">02</span>
              <span className="step-title">GraphRAG 构建</span>
            </div>
            <div className="step-status">
              {phase > 1 ? (
                <span className="badge success">已完成</span>
              ) : phase === 1 ? (
                <span className="badge processing">{job?.progress || 0}%</span>
              ) : (
                <span className="badge pending">等待中</span>
              )}
            </div>
          </div>

          <div className="card-content">
            <p className="api-note">ZEP CLOUD · SOURCE GRAPH · READ ONLY</p>
            <p className="description">分块提交后会持续显示真实阶段和等待时间。原始资料只写入 Source；后续推演只写入 Evolution。</p>

            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{graphStats.nodes}</span>
                <span className="stat-label">实体节点</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{graphStats.edges}</span>
                <span className="stat-label">关系边</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{graphStats.types}</span>
                <span className="stat-label">本体类型</span>
              </div>
            </div>
          </div>
        </div>

        <div className={`step-card${phase === 2 ? ' active completed' : ''}`}>
          <div className="card-header">
            <div className="step-info">
              <span className="step-num">03</span>
              <span className="step-title">构建完成</span>
            </div>
            <div className="step-status">{phase >= 2 && <span className="badge accent">进行中</span>}</div>
          </div>

          <div className="card-content">
            <p className="api-note">NEXT · KNOWLEDGE BOUNDARY</p>
            <p className="description">图谱已就绪。下一步检查哪些是客观真相、公开叙事或角色信念，避免角色知道不该知道的事。</p>
            <button className="action-btn" disabled={phase < 2} onClick={onNextStep}>
              检查知识边界 ➝
            </button>
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
