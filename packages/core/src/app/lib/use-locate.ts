/** Inverse search: a PDF point (page + PDF coords) → the containing frame index, via SyncTeX. */
export async function locate(
  deckId: string,
  page: number,
  x: number,
  y: number,
): Promise<number | null> {
  try {
    const r = await fetch(
      `/__locate/${encodeURIComponent(deckId)}?page=${page}&x=${Math.round(x)}&y=${Math.round(y)}`,
    );
    const d = (await r.json()) as { frameIndex: number | null };
    return typeof d.frameIndex === 'number' ? d.frameIndex : null;
  } catch {
    return null;
  }
}
