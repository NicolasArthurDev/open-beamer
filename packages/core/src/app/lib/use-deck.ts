import { useCallback, useEffect, useState } from 'react';
import { loadPdf, type PdfDoc } from './pdf';

type DeckStatus = { status: 'ok' | 'error'; log: string };

export function useDeck(id: string) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/__pdf/${encodeURIComponent(id)}?t=${Date.now()}`);
      if (!res.ok) {
        const status = (await fetch(`/__status/${encodeURIComponent(id)}`).then((r) =>
          r.json(),
        )) as DeckStatus;
        setError(status.log || 'compilation failed');
        return;
      }
      const buffer = await res.arrayBuffer();
      setDoc(await loadPdf(buffer));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!import.meta.hot) return;
    const onChanged = (data: { id?: string } | undefined) => {
      if (data?.id === id) void refresh();
    };
    // A compile started server-side — show the loading state for its full duration,
    // not just the brief PDF fetch that `deck-changed` triggers.
    const onCompiling = (data: { id?: string } | undefined) => {
      if (data?.id === id) setLoading(true);
    };
    import.meta.hot.on('nitex-studio:deck-changed', onChanged);
    import.meta.hot.on('nitex-studio:deck-compiling', onCompiling);
    return () => {
      import.meta.hot?.off('nitex-studio:deck-changed', onChanged);
      import.meta.hot?.off('nitex-studio:deck-compiling', onCompiling);
    };
  }, [id, refresh]);

  return { doc, error, loading, refresh };
}
