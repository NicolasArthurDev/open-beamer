import { useCallback } from 'react';

export type TexEditOp =
  | { kind: 'title'; frameIndex: number; value: string }
  | { kind: 'text'; frameIndex: number; prevText: string; value: string }
  | { kind: 'fontSize'; frameIndex: number; size: string }
  | { kind: 'color'; frameIndex: number; color: string }
  | { kind: 'reorder'; from: number; to: number }
  | { kind: 'duplicate'; frameIndex: number }
  | { kind: 'delete'; frameIndex: number }
  | { kind: 'runColor'; frameIndex: number; runText: string; color: string }
  | { kind: 'runFontSize'; frameIndex: number; runText: string; size: string }
  | { kind: 'runBold'; frameIndex: number; runText: string }
  | { kind: 'insert'; frameIndex: number; snippet: string }
  | { kind: 'addFrame'; snippet: string; afterIndex: number }
  | { kind: 'deleteComponent'; frameIndex: number; componentIndex: number };

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
