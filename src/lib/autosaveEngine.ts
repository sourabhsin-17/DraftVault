import type { ConflictPayload } from '../types';
import { ApiClientError, apiRequest } from './api';

export type AutosaveStatus =
  | 'idle'
  | 'unsaved'
  | 'saving'
  | 'saved'
  | 'failed'
  | 'retrying'
  | 'conflict';

export interface AutosaveStateSnapshot {
  status: AutosaveStatus;
  version: number;
  lastSavedAt: string | null;
  retryAttempt: number;
  nextRetryInSeconds: number | null;
  errorMessage: string | null;
  isOffline: boolean;
  otherTabWarning: string | null;
  conflict: ConflictPayload | null;
}

export interface PendingDraftSnapshot {
  currentStep: number;
  data: Record<string, unknown>;
  completedSteps: number[];
  changeSummary?: string;
}

export interface LocalRecoveryBuffer {
  baseVersion: number;
  currentStep: number;
  data: Record<string, unknown>;
  completedSteps: number[];
  savedLocallyAt: string;
}

const DEBOUNCE_MS = 800;
const INITIAL_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30000;

function getRecoveryStorageKey(draftId: string) {
  return `afms_unsaved_draft_${draftId}`;
}

function getTabSyncStorageKey(draftId: string) {
  return `afms_tab_sync_${draftId}`;
}

export function readLocalRecoveryBuffer(draftId: string): LocalRecoveryBuffer | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(getRecoveryStorageKey(draftId));
    if (!raw) return null;
    return JSON.parse(raw) as LocalRecoveryBuffer;
  } catch {
    return null;
  }
}

export function clearLocalRecoveryBuffer(draftId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(getRecoveryStorageKey(draftId));
  } catch {
    // Ignore storage errors
  }
}

function writeLocalRecoveryBuffer(draftId: string, buffer: LocalRecoveryBuffer): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(getRecoveryStorageKey(draftId), JSON.stringify(buffer));
  } catch {
    // Ignore quota errors
  }
}

export class AutosaveEngine {
  public readonly draftId: string;
  public readonly tabId: string;

  private version: number;
  private status: AutosaveStatus = 'idle';
  private lastSavedAt: string | null;
  private retryAttempt = 0;
  private nextRetryInSeconds: number | null = null;
  private errorMessage: string | null = null;
  private isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  private otherTabWarning: string | null = null;
  private conflict: ConflictPayload | null = null;

  private latestSnapshot: PendingDraftSnapshot | null = null;
  private dirtySeq = 0;
  private savedSeq = 0;
  private inFlight = false;
  private queuedFlush = false;
  private destroyed = false;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private channel: BroadcastChannel | null = null;
  private activeTabs = new Set<string>();

  private onStateChange: (snapshot: AutosaveStateSnapshot) => void;
  private onServerAck?: (result: { version: number; updatedAt: string }) => void;

  constructor(options: {
    draftId: string;
    initialVersion: number;
    initialUpdatedAt: string | null;
    onStateChange: (snapshot: AutosaveStateSnapshot) => void;
    onServerAck?: (result: { version: number; updatedAt: string }) => void;
  }) {
    this.draftId = options.draftId;
    this.tabId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    this.version = options.initialVersion;
    this.lastSavedAt = options.initialUpdatedAt;
    this.status = options.initialUpdatedAt ? 'saved' : 'idle';
    this.onStateChange = options.onStateChange;
    this.onServerAck = options.onServerAck;

    this.setupNetworkListeners();
    this.setupMultiTabSync();
    this.emitState();
  }

  private emitState() {
    if (this.destroyed) return;
    this.onStateChange({
      status: this.status,
      version: this.version,
      lastSavedAt: this.lastSavedAt,
      retryAttempt: this.retryAttempt,
      nextRetryInSeconds: this.nextRetryInSeconds,
      errorMessage: this.errorMessage,
      isOffline: this.isOffline,
      otherTabWarning: this.otherTabWarning,
      conflict: this.conflict,
    });
  }

  private handleOnline = () => {
    this.isOffline = false;
    if (this.dirtySeq > this.savedSeq && this.status !== 'conflict') {
      this.clearRetryTimers();
      this.retryAttempt = 0;
      void this.flushNow();
    } else {
      this.emitState();
    }
  };

  private handleOffline = () => {
    this.isOffline = true;
    this.errorMessage = 'Connection lost. Changes preserved locally until network resumes.';
    this.emitState();
  };

  private handleTabMessage = (msg: { type: string; tabId: string; version?: number } | null) => {
    if (!msg || msg.tabId === this.tabId) return;

    if (msg.type === 'TAB_OPEN' || msg.type === 'TAB_PING') {
      this.activeTabs.add(msg.tabId);
      this.otherTabWarning =
        'This draft is also open in another browser tab. Concurrent edits may trigger a version conflict.';
      if (msg.type === 'TAB_OPEN') {
        this.broadcastTabEvent({ type: 'TAB_PING', tabId: this.tabId });
      }
      this.emitState();
    } else if (msg.type === 'TAB_CLOSE') {
      this.activeTabs.delete(msg.tabId);
      if (this.activeTabs.size === 0) {
        this.otherTabWarning = null;
        this.emitState();
      }
    } else if (msg.type === 'DRAFT_SAVED') {
      if (typeof msg.version === 'number' && msg.version > this.version) {
        this.otherTabWarning = `Another browser tab just saved version v${msg.version}. Sync or save to review changes.`;
        this.emitState();
      }
    }
  };

  private handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== getTabSyncStorageKey(this.draftId) || !event.newValue) return;
    try {
      const msg = JSON.parse(event.newValue) as { type: string; tabId: string; version?: number };
      this.handleTabMessage(msg);
    } catch {
      // Ignore malformed storage events
    }
  };

  private broadcastTabEvent(payload: { type: string; tabId: string; version?: number }) {
    try {
      this.channel?.postMessage(payload);
    } catch {
      // Ignore BroadcastChannel errors
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          getTabSyncStorageKey(this.draftId),
          JSON.stringify({ ...payload, nonce: Math.random() })
        );
      } catch {
        // Ignore storage errors
      }
    }
  }

  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private setupMultiTabSync() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent);
    }
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(`afms_draft_${this.draftId}`);
        this.channel.onmessage = (event) => {
          this.handleTabMessage(event.data as { type: string; tabId: string; version?: number });
        };
      } catch {
        // Ignore BroadcastChannel restriction if unavailable
      }
    }
    this.broadcastTabEvent({ type: 'TAB_OPEN', tabId: this.tabId });
  }

  public getVersion(): number {
    return this.version;
  }

  public getStatus(): AutosaveStatus {
    return this.status;
  }

  public getConflict(): ConflictPayload | null {
    return this.conflict;
  }

  public hasUnsavedChanges(): boolean {
    return this.dirtySeq > this.savedSeq;
  }

  public setConflict(conflict: ConflictPayload, message?: string) {
    this.status = 'conflict';
    this.conflict = conflict;
    this.errorMessage =
      message || 'A newer version of this draft exists on the server. Resolve the conflict before saving.';
    this.clearTimers();
    this.emitState();
  }

  public syncExternalVersion(version: number, updatedAt: string | null) {
    this.version = version;
    this.lastSavedAt = updatedAt;
    this.conflict = null;
    this.retryAttempt = 0;
    this.nextRetryInSeconds = null;
    this.errorMessage = null;
    this.clearTimers();
    this.savedSeq = this.dirtySeq;
    this.status = 'saved';
    clearLocalRecoveryBuffer(this.draftId);
    this.broadcastTabEvent({ type: 'DRAFT_SAVED', tabId: this.tabId, version: this.version });
    this.emitState();
  }

  public scheduleSave(snapshot: PendingDraftSnapshot) {
    if (this.destroyed || this.status === 'conflict') return;
    this.latestSnapshot = snapshot;
    this.dirtySeq += 1;
    this.errorMessage = null;
    this.clearRetryTimers();

    writeLocalRecoveryBuffer(this.draftId, {
      baseVersion: this.version,
      currentStep: snapshot.currentStep,
      data: snapshot.data,
      completedSteps: snapshot.completedSteps,
      savedLocallyAt: new Date().toISOString(),
    });

    if (this.status !== 'saving') {
      this.status = 'unsaved';
      this.emitState();
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.flushNow();
    }, DEBOUNCE_MS);
  }

  public saveOnBlur(snapshot: PendingDraftSnapshot) {
    if (this.destroyed || this.status === 'conflict') return;
    if (this.dirtySeq === this.savedSeq && !this.debounceTimer) {
      return;
    }
    this.latestSnapshot = snapshot;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    void this.flushNow();
  }

  public async flushNow(): Promise<boolean> {
    if (this.destroyed || !this.latestSnapshot) return true;
    if (this.status === 'conflict') return false;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.inFlight) {
      this.queuedFlush = true;
      return false;
    }

    if (this.dirtySeq === this.savedSeq) {
      return true;
    }

    this.clearRetryTimers();
    this.inFlight = true;
    const seqAtDispatch = this.dirtySeq;
    const payloadSnapshot = {
      ...this.latestSnapshot,
      data: { ...this.latestSnapshot.data },
      completedSteps: [...this.latestSnapshot.completedSteps],
    };

    this.status = 'saving';
    this.errorMessage = null;
    this.nextRetryInSeconds = null;
    this.emitState();

    try {
      const response = await apiRequest<{
        draft: {
          id: string;
          version: number;
          currentStep: number;
          updatedAt: string;
        };
      }>(`/api/drafts/${this.draftId}`, {
        method: 'PUT',
        body: {
          baseVersion: this.version,
          currentStep: payloadSnapshot.currentStep,
          data: payloadSnapshot.data,
          completedSteps: payloadSnapshot.completedSteps,
          tabId: this.tabId,
          clientTimestamp: Date.now(),
          changeSummary: payloadSnapshot.changeSummary,
        },
      });

      this.inFlight = false;
      this.version = response.draft.version;
      this.lastSavedAt = response.draft.updatedAt;
      this.retryAttempt = 0;
      this.nextRetryInSeconds = null;
      this.errorMessage = null;

      if (seqAtDispatch > this.savedSeq) {
        this.savedSeq = seqAtDispatch;
      }

      this.broadcastTabEvent({
        type: 'DRAFT_SAVED',
        tabId: this.tabId,
        version: this.version,
      });
      this.onServerAck?.({ version: this.version, updatedAt: response.draft.updatedAt });

      // If newer edits occurred while request was in flight, immediately flush them safely
      if (this.dirtySeq > this.savedSeq || this.queuedFlush) {
        this.queuedFlush = false;
        this.status = 'unsaved';
        this.emitState();
        return this.flushNow();
      }

      clearLocalRecoveryBuffer(this.draftId);
      this.status = 'saved';
      this.emitState();
      return true;
    } catch (err) {
      this.inFlight = false;
      this.queuedFlush = false;

      if (err instanceof ApiClientError && err.code === 'VERSION_CONFLICT') {
        this.setConflict((err.details as unknown as ConflictPayload) || null, err.message);
        return false;
      }

      if (err instanceof ApiClientError && err.status >= 400 && err.status < 500 && err.status !== 429) {
        this.status = 'failed';
        this.errorMessage = err.message;
        this.emitState();
        return false;
      }

      // Transient network error or 5xx/429 -> exponential backoff retry (2s -> 30s)
      this.scheduleRetry(
        err instanceof Error ? err.message : 'Unable to save draft right now.'
      );
      return false;
    }
  }

  private scheduleRetry(reason: string) {
    if (this.destroyed) return;
    this.retryAttempt += 1;
    const backoffMs = Math.min(
      MAX_BACKOFF_MS,
      INITIAL_BACKOFF_MS * Math.pow(2, this.retryAttempt - 1)
    );
    let remainingSec = Math.ceil(backoffMs / 1000);

    this.status = this.retryAttempt === 1 ? 'failed' : 'retrying';
    this.errorMessage = reason;
    this.nextRetryInSeconds = remainingSec;
    this.emitState();

    this.countdownTimer = setInterval(() => {
      remainingSec = Math.max(0, remainingSec - 1);
      this.nextRetryInSeconds = remainingSec;
      if (this.status === 'failed' && remainingSec < Math.ceil(backoffMs / 1000)) {
        this.status = 'retrying';
      }
      this.emitState();
    }, 1000);

    this.retryTimer = setTimeout(() => {
      this.clearRetryTimers();
      this.status = 'retrying';
      this.nextRetryInSeconds = null;
      this.emitState();
      void this.flushNow();
    }, backoffMs);
  }

  private clearRetryTimers() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private clearTimers() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.clearRetryTimers();
  }

  public destroy() {
    this.destroyed = true;
    this.clearTimers();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
      window.removeEventListener('storage', this.handleStorageEvent);
    }
    try {
      this.broadcastTabEvent({ type: 'TAB_CLOSE', tabId: this.tabId });
      this.channel?.close();
    } catch {
      // Ignore cleanup errors
    }
  }
}
