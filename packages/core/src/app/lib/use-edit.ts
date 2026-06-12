import { useCallback } from 'react';

export type TexEditOp =
  | { kind: 'title'; frameIndex: number; value: string }
  | { kind: 'text'; frameIndex: number; prevText: string; value: string }
  | { kind: 'fontSize'; frameIndex: number; size: string }
  | { kind: 'color'; frameIndex: number; color: string }
  | { kind: 'reorder'; from: number; to: number }
  | { kind: 'duplicate'; frameIndex: number }
  | { kind: 'delete'; frameIndex: number };

export function useEdit(deckId: string) {
  return useCallback(
    async (op: TexEditOp): Promise<boolean> => {
      const res = await fetch('/__edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deckId, op }),
      });
      const data = (await res.json()) as { ok: boolean; changed?: boolean };
      return Boolean(data.changed);
    },
    [deckId],
  );
}
