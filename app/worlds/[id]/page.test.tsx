import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorldDetailPage from './page';
import { SnapshotManager } from '@/engine/snapshot-manager';
import { createInitialWorldSlice } from '@/domain/world';

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

// Mock other components
vi.mock('@/components/chat/chat-shell', () => ({
  ChatShell: () => <div data-testid="chat-shell">Chat</div>,
}));

vi.mock('@/components/panel/panel-shell', () => ({
  PanelShell: () => <div>Panel Shell</div>,
}));

vi.mock('@/components/panel/agent-generator-panel', () => ({
  AgentGeneratorPanel: () => <div>Agent Generator</div>,
}));

vi.mock('@/components/panel/events-panel', () => ({
  EventsPanel: () => <div>Events</div>,
}));

vi.mock('@/components/panel/narrative-panel', () => ({
  NarrativePanel: () => <div>Narrative</div>,
}));

vi.mock('@/components/panel/social-network-panel', () => ({
  SocialNetworkPanel: () => <div>Social Network</div>,
}));

vi.mock('@/components/panel/narrative-timeline-panel', () => ({
  NarrativeTimelinePanel: () => <div>Narrative Timeline</div>,
}));

vi.mock('@/components/panel/houtu-panel', () => ({
  HoutuPanel: () => <div>Houtu</div>,
}));

vi.mock('@/components/panel/agent-observer-panel', () => ({
  AgentObserverPanel: () => <div>Agent Observer</div>,
}));

vi.mock('@/components/panel/system-stats-panel', () => ({
  SystemStatsPanel: () => <div>System Stats</div>,
}));

describe('WorldDetailPage - Snapshot Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Setup initial world in localStorage
    const initialWorld = createInitialWorldSlice();
    initialWorld.world_id = 'test-world-id';
    initialWorld.tick = 5;
    localStorage.setItem('world_test-world-id', JSON.stringify(initialWorld));
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

    // Mock window.prompt
    const mockPrompt = vi.spyOn(window, 'prompt').mockReturnValue('My test snapshot');

    render(<WorldDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('manual-snapshot-button')).toBeInTheDocument();
    });

    const snapshotButton = screen.getByTestId('manual-snapshot-button');
    fireEvent.click(snapshotButton);

    await waitFor(() => {
      expect(mockPrompt).toHaveBeenCalledWith(
        'Enter a label for this snapshot (optional):',
        ''
      );
      expect(mockCreateSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          world_id: 'test-world-id',
          tick: 5,
        }),
        'manual',
        'My test snapshot'
      );
    });

    mockPrompt.mockRestore();
  });

  it('should render SnapshotTimelinePanel', async () => {
    render(<WorldDetailPage />);

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

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-timeline-panel')).toBeInTheDocument();
    });

    // Click restore button in the mocked panel
    const restoreButton = screen.getByText('Restore Test Snapshot');
    fireEvent.click(restoreButton);

    await waitFor(() => {
      expect(mockRestoreSnapshot).toHaveBeenCalledWith('test-snapshot-id');

      // Check localStorage was updated
      const savedWorld = JSON.parse(
        localStorage.getItem('world_test-world-id') || '{}'
      );
      expect(savedWorld.tick).toBe(3);
      expect(savedWorld.tick_summary).toBe('Restored state');
    });
  });

  it('should handle restore failure gracefully', async () => {
    const mockRestoreSnapshot = vi.fn().mockReturnValue(null);
    const mockAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});

    vi.mocked(SnapshotManager).mockImplementation(() => ({
      createSnapshot: vi.fn(),
      listSnapshots: vi.fn(() => []),
      deleteSnapshot: vi.fn(),
      restoreSnapshot: mockRestoreSnapshot,
    }) as any);

    render(<WorldDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-timeline-panel')).toBeInTheDocument();
    });

    const restoreButton = screen.getByText('Restore Test Snapshot');
    fireEvent.click(restoreButton);

    await waitFor(() => {
      expect(mockRestoreSnapshot).toHaveBeenCalledWith('test-snapshot-id');
      expect(mockAlert).toHaveBeenCalledWith('Failed to restore snapshot');
    });

    mockAlert.mockRestore();
  });
});
