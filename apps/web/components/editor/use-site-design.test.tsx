import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME } from '@folyo/core';
import { useSiteDesign } from './use-site-design';
describe('design save serialization', () => {
  it('serializes edits made during a save and never replaces a newer preview with an older response', async () => {
    let complete: (response: Response) => void = () => {};
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve;
          }),
      )
      .mockImplementation(async (_url, input) =>
        Response.json({ theme: JSON.parse(input.body) }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useSiteDesign(DEFAULT_THEME));
    act(() =>
      result.current.update({ ...DEFAULT_THEME, backgroundColor: '#142138' }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    act(() =>
      result.current.update({
        ...result.current.theme,
        backgroundColor: '#f2c9dc',
        galleryLayout: 'featured',
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      complete(
        Response.json({
          theme: { ...DEFAULT_THEME, backgroundColor: '#142138' },
        }),
      );
      await result.current.flush();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toMatchObject({
      backgroundColor: '#f2c9dc',
      galleryLayout: 'featured',
    });
    expect(result.current.theme.backgroundColor).toBe('#f2c9dc');
    expect(result.current.status).toBe('saved');
  });
});
