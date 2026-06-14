import { useCallback, useEffect, useState } from 'react';

/** Maps each visible PDF page to the frame it belongs to (via the server's SyncTeX page map). */
export function usePageMap(id: string) {
  const [pageToFrame, setPageToFrame] = useState<number[]>([]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/__pagemap/${encodeURIComponent(id)}?t=${Date.now()}`);
      const d = (await r.json()) as { pageToFrame: number[] };
      setPageToFrame(d.pageToFrame ?? []);
    } catch {
      setPageToFrame([]);
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

  /** Frame index owning a 1-based PDF page. */
  const frameForPage = useCallback(
    (pdfPage: number) => pageToFrame[pdfPage - 1] ?? 0,
    [pageToFrame],
  );

  return { pageToFrame, frameForPage };
}
