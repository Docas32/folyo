import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutosaveQueue, SaveFailure, type SaveSender } from './autosave';
import type { EditorBlock } from '@folyo/core';
const block: EditorBlock = {
  id: '30000000-0000-4000-8000-000000000003',
  position: 0,
  type: 'text',
  content: { text: 'first' },
};
const changed = (text: string): EditorBlock[] => [
  { ...block, content: { text } },
];
const ack = { savedAt: '2026-10-03T12:00:00.000Z' };
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});
function deferred() {
  let resolve: (value: typeof ack) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<typeof ack>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
describe('autosave queue', () => {
  it('debounces for 1.5 seconds and saves the latest edit only', async () => {
    const send = vi.fn<SaveSender>().mockResolvedValue(ack);
    const queue = new AutosaveQueue(send);
    queue.update(changed('one'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(send).not.toHaveBeenCalled();
    queue.update(changed('two'));
    await vi.advanceTimersByTimeAsync(1499);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(changed('two'));
    expect(queue.snapshot()).toMatchObject({
      status: 'saved',
      savedAt: ack.savedAt,
    });
  });
  it('serializes in-flight saves, drops intermediate revisions and never acknowledges newer edits prematurely', async () => {
    const first = deferred();
    const second = deferred();
    const send = vi
      .fn<SaveSender>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const queue = new AutosaveQueue(send);
    queue.update(changed('one'));
    await vi.advanceTimersByTimeAsync(1500);
    expect(queue.snapshot().status).toBe('saving');
    queue.update(changed('two'));
    queue.update(changed('three'));
    await vi.advanceTimersByTimeAsync(1500);
    expect(send).toHaveBeenCalledOnce();
    first.resolve(ack);
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(changed('three'));
    expect(queue.snapshot().status).toBe('saving');
    second.resolve(ack);
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.snapshot().status).toBe('saved');
  });
  it('waits for the latest debounce when the first save finishes early', async () => {
    const first = deferred();
    const send = vi
      .fn<SaveSender>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(ack);
    const queue = new AutosaveQueue(send);
    queue.update(changed('first'));
    await vi.advanceTimersByTimeAsync(1500);
    queue.update(changed('next'));
    first.resolve(ack);
    await vi.advanceTimersByTimeAsync(1000);
    expect(send).toHaveBeenCalledOnce();
    expect(queue.snapshot().status).toBe('dirty');
    await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('blocks invalid content and identifies the block to fix', async () => {
    const send = vi.fn<SaveSender>().mockResolvedValue(ack);
    const queue = new AutosaveQueue(send);
    queue.update([
      {
        id: block.id,
        position: 0,
        type: 'hero',
        content: { name: '', title: '' },
      },
    ]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(send).not.toHaveBeenCalled();
    expect(queue.snapshot()).toMatchObject({
      status: 'invalid',
      invalidIndex: 0,
    });
    queue.update(changed('fixed'));
    await vi.advanceTimersByTimeAsync(1500);
    expect(send).toHaveBeenCalledOnce();
  });
  it('does not send an obsolete queued snapshot after a newer invalid edit', async () => {
    const first = deferred();
    const send = vi.fn<SaveSender>().mockReturnValue(first.promise);
    const queue = new AutosaveQueue(send);
    queue.update(changed('first'));
    await vi.advanceTimersByTimeAsync(1500);
    queue.update(changed('queued'));
    await vi.advanceTimersByTimeAsync(1500);
    queue.update([
      {
        id: block.id,
        position: 0,
        type: 'image',
        content: { url: 'bad', alt: '' },
      },
    ]);
    first.resolve(ack);
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledOnce();
    expect(queue.snapshot().status).toBe('invalid');
  });
  it('retains the latest edit on a network error and retries manually', async () => {
    const send = vi
      .fn<SaveSender>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(ack);
    const queue = new AutosaveQueue(send);
    queue.update(changed('pending'));
    await vi.advanceTimersByTimeAsync(1500);
    expect(queue.snapshot().status).toBe('error');
    expect(await queue.retry()).toBe(true);
    expect(send).toHaveBeenLastCalledWith(changed('pending'));
  });
  it('continues with a newer queued edit if the old request fails', async () => {
    const first = deferred();
    const send = vi
      .fn<SaveSender>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(ack);
    const queue = new AutosaveQueue(send);
    queue.update(changed('first'));
    await vi.advanceTimersByTimeAsync(1500);
    queue.update(changed('newest'));
    await vi.advanceTimersByTimeAsync(1500);
    first.reject(new Error('old request failed'));
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenLastCalledWith(changed('newest'));
    expect(queue.snapshot().status).toBe('saved');
  });
  it('identifies server content errors without an automatic retry loop', async () => {
    const send = vi.fn<SaveSender>().mockRejectedValue(new SaveFailure(0));
    const queue = new AutosaveQueue(send);
    queue.update(changed('first'));
    await vi.advanceTimersByTimeAsync(1500);
    expect(queue.snapshot()).toMatchObject({
      status: 'invalid',
      invalidIndex: 0,
    });
    expect(await queue.retry()).toBe(false);
    expect(send).toHaveBeenCalledOnce();
  });
  it('flushes pending edits before navigating, including edits during the flush', async () => {
    const first = deferred();
    const send = vi
      .fn<SaveSender>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(ack);
    const queue = new AutosaveQueue(send);
    queue.update(changed('first'));
    const flushing = queue.flush();
    await vi.advanceTimersByTimeAsync(0);
    queue.update(changed('new'));
    first.resolve(ack);
    expect(await flushing).toBe(true);
    expect(send).toHaveBeenLastCalledWith(changed('new'));
  });
  it('keeps independent snapshots even if caller mutates its own array', async () => {
    const send = vi.fn<SaveSender>().mockResolvedValue(ack);
    const queue = new AutosaveQueue(send);
    const input = changed('original');
    queue.update(input);
    const current = input[0];
    if (current?.type === 'text') current.content.text = 'mutation';
    await vi.advanceTimersByTimeAsync(1500);
    expect(send).toHaveBeenCalledWith(changed('original'));
  });
  it('clears debounce timers on unmount and survives a StrictMode resubscription', async () => {
    const send = vi.fn<SaveSender>().mockResolvedValue(ack);
    const queue = new AutosaveQueue(send);
    queue.update(changed('pending'));
    queue.dispose();
    await vi.advanceTimersByTimeAsync(2000);
    expect(send).not.toHaveBeenCalled();
    queue.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(1500);
    expect(send).toHaveBeenCalledOnce();
  });
});
