import React, { useState, useEffect } from 'react';
import {
  Clock,
  User,
  BookOpen,
  Trash2,
  RotateCcw,
  Bookmark,
  Skull,
  Baby,
  Zap,
  TrendingUp,
  Heart,
  Package,
  Globe,
} from 'lucide-react';
import { SnapshotManager } from '@/engine/snapshot-manager';
import type { SnapshotMetadata, SnapshotTrigger } from '@/domain/snapshot';

type SnapshotTimelinePanelProps = {
  worldId: string;
  onRestore?: (snapshotId: string) => void;
};

const triggerConfig: Record<
  SnapshotTrigger,
  { icon: React.ElementType; label: string; color: string }
> = {
  manual: {
    icon: Bookmark,
    label: 'Manual',
    color: 'bg-blue-100 text-blue-600 border-blue-200',
  },
  agent_death: {
    icon: Skull,
    label: 'Agent Death',
    color: 'bg-red-100 text-red-600 border-red-200',
  },
  agent_birth: {
    icon: Baby,
    label: 'Agent Birth',
    color: 'bg-green-100 text-green-600 border-green-200',
  },
  tension_climax: {
    icon: Zap,
    label: 'Tension Climax',
    color: 'bg-yellow-100 text-yellow-600 border-yellow-200',
  },
  narrative_turn: {
    icon: TrendingUp,
    label: 'Narrative Turn',
    color: 'bg-purple-100 text-purple-600 border-purple-200',
  },
  relationship: {
    icon: Heart,
    label: 'Relationship',
    color: 'bg-pink-100 text-pink-600 border-pink-200',
  },
  resource: {
    icon: Package,
    label: 'Resource',
    color: 'bg-amber-100 text-amber-600 border-amber-200',
  },
  world_event: {
    icon: Globe,
    label: 'World Event',
    color: 'bg-cyan-100 text-cyan-600 border-cyan-200',
  },
};

export function SnapshotTimelinePanel({
  worldId,
  onRestore,
}: SnapshotTimelinePanelProps) {
  const [snapshots, setSnapshots] = useState<SnapshotMetadata[]>([]);
  const [manager] = useState(() => new SnapshotManager(worldId));

  // Load snapshots on mount
  useEffect(() => {
    const loadSnapshots = () => {
      const loaded = manager.listSnapshots();
      setSnapshots(loaded);
    };
    loadSnapshots();
  }, [manager]);

  const handleDelete = (snapshotId: string) => {
    try {
      manager.deleteSnapshot(snapshotId);
      // Reload snapshots after deletion
      setSnapshots(manager.listSnapshots());
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
    }
  };

  const handleRestore = (snapshotId: string) => {
    if (onRestore) {
      onRestore(snapshotId);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-slate-500" />
        <h2 className="text-lg font-semibold text-slate-800">
          Snapshot Timeline
        </h2>
      </div>

      {snapshots.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          No snapshots yet
        </p>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snapshot) => {
            const config = triggerConfig[snapshot.trigger];
            const IconComponent = config.icon;

            return (
              <div
                key={snapshot.id}
                className={`rounded-lg border px-4 py-3 shadow-sm transition-colors hover:bg-slate-50 ${
                  snapshot.isManual
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${config.color}`}
                      >
                        <IconComponent className="h-3 w-3" />
                        {config.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatTimestamp(snapshot.timestamp)}
                      </span>
                    </div>

                    {/* Label or Description */}
                    <div className="text-sm font-medium text-slate-700">
                      {snapshot.label || snapshot.description}
                    </div>

                    {/* Thumbnail Info */}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>
                          {snapshot.thumbnail.aliveAgentCount}/
                          {snapshot.thumbnail.agentCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        <span>{snapshot.thumbnail.narrativeCount}</span>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                        Tick {snapshot.tick}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => handleRestore(snapshot.id)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                      title="Restore this snapshot"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                    {!snapshot.isManual && (
                      <button
                        onClick={() => handleDelete(snapshot.id)}
                        className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        title="Delete this snapshot"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

