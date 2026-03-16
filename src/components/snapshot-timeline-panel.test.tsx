import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SnapshotTimelinePanel } from './snapshot-timeline-panel';
import type { SnapshotMetadata } from '@/domain/snapshot';

// Mock SnapshotManager
vi.mock('@/engine/snapshot-manager', () => ({
  SnapshotManager: vi.fn().mockImplementation(() => ({
    listSnapshots: vi.fn(() => []),
    deleteSnapshot: vi.fn(),
  })),
}));

describe('SnapshotTimelinePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no snapshots exist', () => {
    render(<SnapshotTimelinePanel worldId="test-world" />);
    expect(screen.getByText(/no snapshots/i)).toBeInTheDocument();
  });

  it('renders snapshot list with metadata', async () => {
    const mockSnapshots: SnapshotMetadata[] = [
      {
        id: 'snap-1',
        worldId: 'test-world',
        tick: 10,
        timestamp: '2026-03-16T10:00:00.000Z',
        trigger: 'manual',
        label: 'Test Snapshot',
        description: 'Manual snapshot',
        thumbnail: {
          agentCount: 5,
          aliveAgentCount: 4,
          narrativeCount: 2,
          eventSummary: 'agent_death, tick',
        },
        isManual: true,
      },
      {
        id: 'snap-2',
        worldId: 'test-world',
        tick: 5,
        timestamp: '2026-03-16T09:00:00.000Z',
        trigger: 'agent_death',
        description: 'Agent death detected',
        thumbnail: {
          agentCount: 5,
          aliveAgentCount: 4,
          narrativeCount: 2,
          eventSummary: 'agent_death',
        },
        isManual: false,
      },
    ];

    const { SnapshotManager } = await import('@/engine/snapshot-manager');
    const mockListSnapshots = vi.fn(() => mockSnapshots);
    (SnapshotManager as any).mockImplementation(() => ({
      listSnapshots: mockListSnapshots,
      deleteSnapshot: vi.fn(),
    }));

    render(<SnapshotTimelinePanel worldId="test-world" />);

    expect(screen.getByText('Test Snapshot')).toBeInTheDocument();
    expect(screen.getByText(/manual snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/agent death detected/i)).toBeInTheDocument();
  });

  it('shows delete button only for auto-snapshots', async () => {
    const mockSnapshots: SnapshotMetadata[] = [
      {
        id: 'snap-manual',
        worldId: 'test-world',
        tick: 10,
        timestamp: '2026-03-16T10:00:00.000Z',
        trigger: 'manual',
        description: 'Manual snapshot',
        thumbnail: {
          agentCount: 5,
          aliveAgentCount: 4,
          narrativeCount: 2,
          eventSummary: 'tick',
        },
        isManual: true,
      },
      {
        id: 'snap-auto',
        worldId: 'test-world',
        tick: 5,
        timestamp: '2026-03-16T09:00:00.000Z',
        trigger: 'agent_death',
        description: 'Agent death detected',
        thumbnail: {
          agentCount: 5,
          aliveAgentCount: 4,
          narrativeCount: 2,
          eventSummary: 'agent_death',
        },
        isManual: false,
      },
    ];

    const { SnapshotManager } = await import('@/engine/snapshot-manager');
    const mockListSnapshots = vi.fn(() => mockSnapshots);
    (SnapshotManager as any).mockImplementation(() => ({
      listSnapshots: mockListSnapshots,
      deleteSnapshot: vi.fn(),
    }));

    render(<SnapshotTimelinePanel worldId="test-world" />);

    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
    // Only one delete button should exist (for auto-snapshot)
    expect(deleteButtons).toHaveLength(1);
  });

  it('calls onRestore when restore button is clicked', async () => {
    const mockSnapshots: SnapshotMetadata[] = [
      {
        id: 'snap-1',
        worldId: 'test-world',
        tick: 10,
        timestamp: '2026-03-16T10:00:00.000Z',
        trigger: 'manual',
        description: 'Manual snapshot',
        thumbnail: {
          agentCount: 5,
          aliveAgentCount: 4,
          narrativeCount: 2,
          eventSummary: 'tick',
        },
        isManual: true,
      },
    ];

    const { SnapshotManager } = await import('@/engine/snapshot-manager');
    const mockListSnapshots = vi.fn(() => mockSnapshots);
    (SnapshotManager as any).mockImplementation(() => ({
      listSnapshots: mockListSnapshots,
      deleteSnapshot: vi.fn(),
    }));

    const onRestore = vi.fn();
    render(<SnapshotTimelinePanel worldId="test-world" onRestore={onRestore} />);

    const restoreButton = screen.getByRole('button', { name: /restore/i });
    fireEvent.click(restoreButton);

    expect(onRestore).toHaveBeenCalledWith('snap-1');
  });

  it('calls deleteSnapshot when delete button is clicked', async () => {
    const mockSnapshots: SnapshotMetadata[] = [
      {
        id: 'snap-auto',
        worldId: 'test-world',
        tick: 5,
        timestamp: '2026-03-16T09:00:00.000Z',
        trigger: 'agent_death',
        description: 'Agent death detected',
        thumbnail: {
          agentCount: 5,
          aliveAgentCount: 4,
          narrativeCount: 2,
          eventSummary: 'agent_death',
        },
        isManual: false,
      },
    ];

    const { SnapshotManager } = await import('@/engine/snapshot-manager');
    const mockDeleteSnapshot = vi.fn();
    const mockListSnapshots = vi.fn(() => mockSnapshots);
    (SnapshotManager as any).mockImplementation(() => ({
      listSnapshots: mockListSnapshots,
      deleteSnapshot: mockDeleteSnapshot,
    }));

    render(<SnapshotTimelinePanel worldId="test-world" />);

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    expect(mockDeleteSnapshot).toHaveBeenCalledWith('snap-auto');
  });
});

