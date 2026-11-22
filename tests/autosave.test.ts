import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AutosaveEngine,
  clearLocalRecoveryBuffer,
  readLocalRecoveryBuffer,
  type AutosaveStateSnapshot,
} from '../src/lib/autosaveEngine';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => store.get(k) ?? null,
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => {
      store.delete(k);
    },
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
}

describe('AutosaveEngine - Debounce, Backoff, Conflict, Recovery & Multi-Tab Sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const listeners = new Map<string, Set<(ev: Event) => void>>();
    const mockStorage = createMemoryStorage();
    vi.stubGlobal('window', {
      localStorage: mockStorage,
      addEventListener: (type: string, fn: (ev: Event) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: (ev: Event) => void) => {
        listeners.get(type)?.delete(fn);
      },
      dispatchEvent: (ev: Event & { key?: string; newValue?: string }) => {
        listeners.get(ev.type)?.forEach((fn) => fn(ev));
        return true;
      },
    });
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('debounces typing by 800ms, maintains local recovery buffer while dirty, and clears buffer on save', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          draft: {
            id: 'draft-1',
            version: 2,
            currentStep: 1,
            updatedAt: '2026-11-21T12:00:00.000Z',
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const states: AutosaveStateSnapshot[] = [];
    const engine = new AutosaveEngine({
      draftId: 'draft-1',
      initialVersion: 1,
      initialUpdatedAt: null,
      onStateChange: (s) => states.push(s),
    });

    engine.scheduleSave({
      currentStep: 1,
      data: { fullName: 'J' },
      completedSteps: [],
    });
    engine.scheduleSave({
      currentStep: 1,
      data: { fullName: 'Jordan' },
      completedSteps: [],
    });

    // Local recovery buffer preserves unsaved edit before 800ms elapses
    const buffered = readLocalRecoveryBuffer('draft-1');
    expect(buffered?.data.fullName).toBe('Jordan');
    expect(buffered?.baseVersion).toBe(1);

    // At 700ms, debounce has not fired yet
    await vi.advanceTimersByTimeAsync(700);
    expect(fetchMock).not.toHaveBeenCalled();

    // At 800ms total, single debounced request fires with latest data
    await vi.advanceTimersByTimeAsync(150);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.baseVersion).toBe(1);
    expect(body.data.fullName).toBe('Jordan');
    expect(engine.getVersion()).toBe(2);
    expect(states[states.length - 1]?.status).toBe('saved');
    // Recovery buffer cleared once server confirms save
    expect(readLocalRecoveryBuffer('draft-1')).toBeNull();

    clearLocalRecoveryBuffer('draft-1');
    engine.destroy();
  });

  it('retries failed saves with exponential backoff starting at 2s and doubling', async () => {
    let attemptCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      attemptCount += 1;
      if (attemptCount < 3) {
        return {
          ok: false,
          status: 503,
          json: async () => ({
            success: false,
            error: { code: 'SERVICE_UNAVAILABLE', message: 'Temporary outage' },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            draft: {
              id: 'draft-2',
              version: 2,
              currentStep: 1,
              updatedAt: '2026-11-21T12:01:00.000Z',
            },
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const engine = new AutosaveEngine({
      draftId: 'draft-2',
      initialVersion: 1,
      initialUpdatedAt: null,
      onStateChange: () => {},
    });

    engine.scheduleSave({
      currentStep: 1,
      data: { fullName: 'Retry User' },
      completedSteps: [],
    });
    engine.saveOnBlur({
      currentStep: 1,
      data: { fullName: 'Retry User' },
      completedSteps: [],
    });

    // Initial immediate attempt fails
    await vi.advanceTimersByTimeAsync(10);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // After 2000ms (first backoff), attempt #2 fires and fails
    await vi.advanceTimersByTimeAsync(2050);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // At 2000ms more (not yet 4000ms), attempt #3 has not fired
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // At 4000ms total for second backoff, attempt #3 succeeds
    await vi.advanceTimersByTimeAsync(2050);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(engine.getVersion()).toBe(2);

    engine.destroy();
  });

  it('flushes newer edits that arrive while an earlier save is in flight without losing changes', async () => {
    let resolveFirst!: (val: unknown) => void;
    let callIndex = 0;

    const fetchMock = vi.fn().mockImplementation(() => {
      callIndex += 1;
      if (callIndex === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            draft: {
              id: 'draft-3',
              version: 3,
              currentStep: 1,
              updatedAt: '2026-11-21T12:02:00.000Z',
            },
          },
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const engine = new AutosaveEngine({
      draftId: 'draft-3',
      initialVersion: 1,
      initialUpdatedAt: null,
      onStateChange: () => {},
    });

    engine.scheduleSave({
      currentStep: 1,
      data: { fullName: 'First Edit' },
      completedSteps: [],
    });
    engine.saveOnBlur({
      currentStep: 1,
      data: { fullName: 'First Edit' },
      completedSteps: [],
    });
    await vi.advanceTimersByTimeAsync(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // While #1 is still pending, user types a newer edit
    engine.scheduleSave({
      currentStep: 1,
      data: { fullName: 'Newer Edit' },
      completedSteps: [],
    });

    // Now resolve #1 (version 2)
    resolveFirst({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          draft: {
            id: 'draft-3',
            version: 2,
            currentStep: 1,
            updatedAt: '2026-11-21T12:01:55.000Z',
          },
        },
      }),
    });

    await vi.advanceTimersByTimeAsync(50);

    // Engine automatically dispatches #2 using updated baseVersion: 2 and newest data
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(secondBody.baseVersion).toBe(2);
    expect(secondBody.data.fullName).toBe('Newer Edit');
    expect(engine.getVersion()).toBe(3);

    engine.destroy();
  });

  it('detects 409 VERSION_CONFLICT, handles offline/online transitions, and warns when another tab edits the same draft', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: {
          code: 'VERSION_CONFLICT',
          message: 'Newer version exists on server.',
          details: {
            serverVersion: 3,
            serverCurrentStep: 2,
            serverUpdatedAt: '2026-11-21T12:05:00.000Z',
            serverLastTabId: 'other99',
            serverData: { fullName: 'Server Version' },
            serverCompletedSteps: [1],
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    let latestState!: AutosaveStateSnapshot;
    const engine = new AutosaveEngine({
      draftId: 'draft-4',
      initialVersion: 1,
      initialUpdatedAt: null,
      onStateChange: (s) => {
        latestState = s;
      },
    });

    // Simulate another tab opening the same draft via localStorage storage event
    window.dispatchEvent({
      type: 'storage',
      key: 'afms_tab_sync_draft-4',
      newValue: JSON.stringify({ type: 'TAB_OPEN', tabId: 'tab-other' }),
    } as unknown as Event);
    expect(latestState.otherTabWarning).toContain('another browser tab');

    // Simulate offline -> online transition
    window.dispatchEvent({ type: 'offline' } as Event);
    expect(latestState.isOffline).toBe(true);
    window.dispatchEvent({ type: 'online' } as Event);
    expect(latestState.isOffline).toBe(false);

    // Trigger save that hits 409 VERSION_CONFLICT
    engine.scheduleSave({
      currentStep: 1,
      data: { fullName: 'Local Version' },
      completedSteps: [],
    });
    engine.saveOnBlur({
      currentStep: 1,
      data: { fullName: 'Local Version' },
      completedSteps: [],
    });
    await vi.advanceTimersByTimeAsync(10);

    expect(latestState.status).toBe('conflict');
    expect(latestState.conflict?.serverVersion).toBe(3);

    engine.destroy();
  });
});
