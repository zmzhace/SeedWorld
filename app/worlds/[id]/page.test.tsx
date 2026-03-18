import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import WorldDetailPage from './page';
import { SnapshotManager } from '@/engine/snapshot-manager';
import { createInitialWorldSlice } from '@/domain/world';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-world-id' }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/store/worlds', () => ({
  getWorld: vi.fn(() => ({
    id: 'test-world-id',
    worldPrompt: 'Test world prompt',
    createdAt: new Date().toISOString(),
  })),
}));

vi.mock('@/engine/orchestrator', () => ({
  runWorldTick: vi.fn(async (world) => ({
    ...world,
    tick: world.tick + 1,
  })),
}));

vi.mock('@/engine/snapshot-manager');

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

vi.mock('@/components/snapshot-timeline-panel', () => ({
  SnapshotTimelinePanel: ({ worldId, onRestore }: any) => (
    <div data-testid="snapshot-timeline-panel">
      <span>World ID: {worldId}</span>
      <button onClick={() => onRestore('test-snapshot-id')}>
        Restore Test Snapshot
      </button>
    </div>
  ),
}));

vi.mock('@/components/chat/chat-shell', () => ({
  ChatShell: () => <div data-testid="chat-shell">Chat</div>,
}));
vi.mock('@/components/panel/panel-shell', () => ({ PanelShell: () => <div>Panel Shell</div> }));
vi.mock('@/components/panel/agent-generator-panel', () => ({ AgentGeneratorPanel: () => <div>Agent Generator</div> }));
vi.mock('@/components/panel/events-panel', () => ({ EventsPanel: () => <div>Events</div> }));
vi.mock('@/components/panel/narrative-panel', () => ({ NarrativePanel: () => <div>Narrative</div> }));
vi.mock('@/components/panel/social-network-panel', () => ({ SocialNetworkPanel: () => <div>Social Network</div> }));
vi.mock('@/components/panel/narrative-timeline-panel', () => ({ NarrativeTimelinePanel: () => <div>Narrative Timeline</div> }));
vi.mock('@/components/panel/houtu-panel', () => ({ HoutuPanel: () => <div>Houtu</div> }));
vi.mock('@/components/panel/agent-observer-panel', () => ({ AgentObserverPanel: () => <div>Agent Observer</div> }));
vi.mock('@/components/panel/system-stats-panel', () => ({ SystemStatsPanel: () => <div>System Stats</div> }));

function clickSnapshotsTab() {
  const tabButton = screen
    .getAllByRole('button')
    .find((button) => button.textContent?.trim() === 'Snapshots');

  if (!tabButton) {
    throw new Error('Snapshots tab button not found');
  }

  fireEvent.click(tabButton);
}

describe('WorldDetailPage - Snapshot Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    const initialWorld = createInitialWorldSlice();
    initialWorld.world_id = 'test-world-id';
    initialWorld.tick = 5;
    localStorage.setItem('world_test-world-id', JSON.stringify(initialWorld));
  });

  afterEach(() => {
    cleanup();
  });

  it('should create an automatic snapshot for tick 0 when loading a new world', async () => {
    localStorage.clear();
    const initialWorld = createInitialWorldSlice();
    initialWorld.world_id = 'test-world-id';
    initialWorld.tick = 0;
    localStorage.setItem('world_test-world-id', JSON.stringify(initialWorld));

    const mockCreateSnapshot = vi.fn();

    vi.mocked(SnapshotManager).mockImplementation(() => ({
      createSnapshot: mockCreateSnapshot,
      listSnapshots: vi.fn(() => []),
      deleteSnapshot: vi.fn(),
      restoreSnapshot: vi.fn(),
    }) as any);

    render(<WorldDetailPage />);

    await waitFor(() => {
      expect(mockCreateSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ world_id: 'test-world-id', tick: 0 }),
        'world_event',
        'Tick 0'
      );
    });
  });

  it('should render manual snapshot button', async () => {
    render(<WorldDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('manual-snapshot-button')).toBeInTheDocument();
    });
  });

  it('should create manual snapshot when button is clicked', async () => {
    const mockCreateSnapshot = vi.fn().mockReturnValue({
      id: 'new-snapshot-id',
      worldId: 'test-world-id',
      tick: 5,
      timestamp: new Date().toISOString(),
      trigger: 'manual',
      description: 'Manual snapshot',
      isManual: true,
      thumbnail: {
        agentCount: 0,
        aliveAgentCount: 0,
        narrativeCount: 0,
        eventSummary: 'No recent events',
      },
    });

    vi.mocked(SnapshotManager).mockImplementation(() => ({
      createSnapshot: mockCreateSnapshot,
      listSnapshots: vi.fn(() => []),
      deleteSnapshot: vi.fn(),
      restoreSnapshot: vi.fn(),
    }) as any);

    const mockPrompt = vi.spyOn(window, 'prompt').mockReturnValue('My test snapshot');

    render(<WorldDetailPage />);
    fireEvent.click(screen.getByTestId('manual-snapshot-button'));

    await waitFor(() => {
      expect(mockPrompt).toHaveBeenCalledWith('Enter a label for this snapshot (optional):', '');
      expect(mockCreateSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ world_id: 'test-world-id', tick: 5 }),
        'manual',
        'My test snapshot'
      );
    });

    mockPrompt.mockRestore();
  });

  it('should render snapshot timeline panel when snapshots tab is selected', async () => {
    render(<WorldDetailPage />);
    clickSnapshotsTab();

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-timeline-panel')).toBeInTheDocument();
    });
  });

  it('should restore snapshot and update world state', async () => {
    const restoredWorld = createInitialWorldSlice();
    restoredWorld.world_id = 'test-world-id';
    restoredWorld.tick = 3;
    restoredWorld.tick_summary = 'Restored state';

    const mockRestoreSnapshot = vi.fn().mockReturnValue(restoredWorld);

    vi.mocked(SnapshotManager).mockImplementation(() => ({
      createSnapshot: vi.fn(),
      listSnapshots: vi.fn(() => []),
      deleteSnapshot: vi.fn(),
      restoreSnapshot: mockRestoreSnapshot,
    }) as any);

    render(<WorldDetailPage />);
    clickSnapshotsTab();
    fireEvent.click(screen.getByText('Restore Test Snapshot'));

    await waitFor(() => {
      expect(mockRestoreSnapshot).toHaveBeenCalledWith('test-snapshot-id');
      const savedWorld = JSON.parse(localStorage.getItem('world_test-world-id') || '{}');
      expect(savedWorld.tick).toBe(3);
      expect(savedWorld.tick_summary).toBe('Restored state');
    });
  });

  it('should handle restore failure gracefully', async () => {
    const mockRestoreSnapshot = vi.fn().mockReturnValue(null);

    vi.mocked(SnapshotManager).mockImplementation(() => ({
      createSnapshot: vi.fn(),
      listSnapshots: vi.fn(() => []),
      deleteSnapshot: vi.fn(),
      restoreSnapshot: mockRestoreSnapshot,
    }) as any);

    render(<WorldDetailPage />);
    clickSnapshotsTab();
    fireEvent.click(screen.getByText('Restore Test Snapshot'));

    await waitFor(() => {
      expect(mockRestoreSnapshot).toHaveBeenCalledWith('test-snapshot-id');
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to restore snapshot',
        expect.objectContaining({ description: 'Snapshot not found or corrupted' })
      );
    });
  });

  it('should show toast notification when manual snapshot is created', async () => {
    const mockCreateSnapshot = vi.fn().mockReturnValue({
      id: 'new-snapshot-id',
      worldId: 'test-world-id',
      tick: 5,
      timestamp: new Date().toISOString(),
      trigger: 'manual',
      description: 'Manual snapshot',
      isManual: true,
      thumbnail: {
        agentCount: 0,
        aliveAgentCount: 0,
        narrativeCount: 0,
        eventSummary: 'No recent events',
      },
    });

    vi.mocked(SnapshotManager).mockImplementation(() => ({
      createSnapshot: mockCreateSnapshot,
      listSnapshots: vi.fn(() => []),
      deleteSnapshot: vi.fn(),
      restoreSnapshot: vi.fn(),
    }) as any);

    const mockPrompt = vi.spyOn(window, 'prompt').mockReturnValue('Test snapshot');

    render(<WorldDetailPage />);
    fireEvent.click(screen.getByTestId('manual-snapshot-button'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Snapshot created'),
        expect.objectContaining({ description: expect.stringContaining('Test snapshot') })
      );
    });

    mockPrompt.mockRestore();
  });

  it('should show toast notification when snapshot is restored', async () => {
    const restoredWorld = createInitialWorldSlice();
    restoredWorld.world_id = 'test-world-id';
    restoredWorld.tick = 3;

    const mockRestoreSnapshot = vi.fn().mockReturnValue(restoredWorld);

    vi.mocked(SnapshotManager).mockImplementation(() => ({
      createSnapshot: vi.fn(),
      listSnapshots: vi.fn(() => []),
      deleteSnapshot: vi.fn(),
      restoreSnapshot: mockRestoreSnapshot,
    }) as any);

    render(<WorldDetailPage />);
    clickSnapshotsTab();
    fireEvent.click(screen.getByText('Restore Test Snapshot'));

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining('Snapshot restored'),
        expect.objectContaining({ description: expect.stringContaining('tick 3') })
      );
    });
  });
});

