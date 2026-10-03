import { saveBlocksSchema, type EditorBlock } from '@folyo/core';
export const AUTOSAVE_DELAY = 1500;
export type SaveState = {
  status: 'saved' | 'dirty' | 'saving' | 'error' | 'invalid';
  savedAt: string | null;
  invalidIndex: number | null;
};
export class SaveFailure extends Error {
  constructor(public invalidIndex: number | null = null) {
    super('save_failed');
  }
}
export type SaveSender = (
  blocks: EditorBlock[],
) => Promise<{ savedAt: string }>;
// One request at a time, replacing the queued snapshot with the newest valid
// revision. An older response can never mark newer edits as saved.
export class AutosaveQueue {
  private state: SaveState = {
    status: 'saved',
    savedAt: null,
    invalidIndex: null,
  };
  private listeners = new Set<(state: SaveState) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private revision = 0;
  private savedRevision = 0;
  private desired: { revision: number; blocks: EditorBlock[] } | null = null;
  private running: Promise<void> | null = null;
  private ready = false;
  private closed = false;
  constructor(private send: SaveSender) {}
  snapshot() {
    return this.state;
  }
  subscribe(listener: (state: SaveState) => void) {
    this.closed = false;
    this.listeners.add(listener);
    listener(this.state);
    if (
      this.desired &&
      this.desired.revision > this.savedRevision &&
      !this.running &&
      this.state.status !== 'error'
    )
      this.schedule();
    return () => {
      this.listeners.delete(listener);
    };
  }
  private publish(patch: Partial<SaveState>) {
    this.state = { ...this.state, ...patch };
    if (!this.closed)
      this.listeners.forEach((listener) => listener(this.state));
  }
  private cancelTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  private schedule() {
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.ready = true;
      void this.drain();
    }, AUTOSAVE_DELAY);
  }
  update(blocks: EditorBlock[]) {
    this.revision++;
    this.ready = false;
    this.cancelTimer();
    const result = saveBlocksSchema.safeParse({ blocks });
    if (!result.success) {
      this.desired = null;
      const path = result.error.issues.find(
        (issue) => typeof issue.path[1] === 'number',
      )?.path;
      this.publish({
        status: 'invalid',
        invalidIndex: typeof path?.[1] === 'number' ? path[1] : 0,
      });
      return;
    }
    this.desired = { revision: this.revision, blocks: result.data.blocks };
    this.publish({
      status: this.running ? 'saving' : 'dirty',
      invalidIndex: null,
    });
    this.schedule();
  }
  private drain(): Promise<void> {
    if (this.running) return this.running;
    const snapshot = this.desired;
    if (
      this.closed ||
      !snapshot ||
      snapshot.revision <= this.savedRevision ||
      !this.ready
    )
      return Promise.resolve();
    this.ready = false;
    this.publish({ status: 'saving', invalidIndex: null });
    this.running = Promise.resolve()
      .then(() => this.send(snapshot.blocks))
      .then((result) => {
        this.savedRevision = snapshot.revision;
        if (this.desired?.revision === snapshot.revision)
          this.publish({ status: 'saved', savedAt: result.savedAt });
        else
          this.publish({
            savedAt: result.savedAt,
            ...(this.desired ? { status: 'dirty' as const } : {}),
          });
      })
      .catch((error: unknown) => {
        // Preserve a newer invalid edit; its corrective message is more useful
        // than an error belonging to the previous valid snapshot.
        if (!this.desired) return;
        if (this.desired.revision !== snapshot.revision) {
          this.publish({ status: 'dirty', invalidIndex: null });
          return;
        }
        const invalidIndex =
          error instanceof SaveFailure ? error.invalidIndex : null;
        this.publish({
          status:
            invalidIndex !== null && this.desired.revision === snapshot.revision
              ? 'invalid'
              : 'error',
          invalidIndex,
        });
        this.ready = false;
      })
      .finally(() => {
        this.running = null;
        if (this.ready && !this.closed) void this.drain();
      });
    return this.running;
  }
  async flush(): Promise<boolean> {
    this.cancelTimer();
    if (this.state.status === 'invalid' || this.closed) return false;
    this.ready = true;
    do {
      await this.drain();
      const status = this.snapshot().status;
      if (status === 'error' || status === 'invalid' || this.closed)
        return false;
      this.ready = Boolean(
        this.desired && this.desired.revision > this.savedRevision,
      );
    } while (this.ready || this.running);
    return this.state.status === 'saved';
  }
  retry() {
    return this.flush();
  }
  dispose() {
    this.closed = true;
    this.ready = false;
    this.cancelTimer();
    this.listeners.clear();
  }
}
