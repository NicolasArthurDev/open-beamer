import { useCallback, useEffect, useState } from 'react';

/** Maps the visible PDF page to the frame it belongs to (via the server's SyncTeX page map). */
export function usePageMap(id: string) {
  const [framePages, setFramePages] = useState<number[]>([]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/__pagemap/${encodeURIComponent(id)}?t=${Date.now()}`);
      const d = (await r.json()) as { framePages: number[] };
      setFramePages(d.framePages ?? []);
    } catch {
      setFramePages([]);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!import.meta.hot) return;
    const handler = (data: { id?: string } | undefined) => {
      if (data?.id === id) void refresh();
    };
    import.meta.hot.on('open-beamer:deck-changed', handler);
    return () => {
      import.meta.hot?.off('open-beamer:deck-changed', handler);
    };
  }, [id, refresh]);

  /** Frame index owning a 1-based PDF page (the last frame whose first page is ≤ page). */
  const frameForPage = useCallback(
    (pdfPage: number) => {
      let active = 0;
      framePages.forEach((firstPage, index) => {
        if (firstPage <= pdfPage) active = index;
      });
      return active;
    },
    [framePages],
  );

  return { framePages, frameForPage };
}
