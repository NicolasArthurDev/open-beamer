import { useCallback, useEffect, useState } from 'react';

export type ComponentInfo = { index: number; env: string; label: string };
export type NiboxInfo = { index: number; x: number; y: number; w: number; text: string };
export type FrameInfo = {
  index: number;
  title: string;
  texts: string[];
  components: ComponentInfo[];
  niboxes: NiboxInfo[];
};

export function useOutline(id: string) {
  const [frames, setFrames] = useState<FrameInfo[]>([]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/__outline/${encodeURIComponent(id)}?t=${Date.now()}`);
      const d = (await r.json()) as { frames: FrameInfo[] };
      setFrames(d.frames ?? []);
    } catch {
      setFrames([]);
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
    import.meta.hot.on('nitex-studio:deck-changed', handler);
    return () => {
      import.meta.hot?.off('nitex-studio:deck-changed', handler);
    };
  }, [id, refresh]);

  return { frames, refresh };
}
