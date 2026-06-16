import type { TexEditOp } from '@nitex-studio/editing';
import { useCallback } from 'react';

export type { TexEditOp };

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

/** Undo / redo the deck's last source change (server keeps the snapshot history). */
export function useHistory(deckId: string) {
  const step = useCallback(
    async (dir: 'undo' | 'redo'): Promise<boolean> => {
      const res = await fetch(`/__${dir}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deckId }),
      });
      const data = (await res.json()) as { ok: boolean; changed?: boolean };
      return Boolean(data.changed);
    },
    [deckId],
  );
  return {
    undo: useCallback(() => step('undo'), [step]),
    redo: useCallback(() => step('redo'), [step]),
  };
}
