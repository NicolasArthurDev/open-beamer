import { useEffect, useRef, useState } from 'react';
import type { NiboxInfo } from '../lib/use-outline';

const clamp = (v: number) => Math.max(0, Math.min(100, v));

type Move = (index: number, x: number, y: number) => void;
type Resize = (index: number, w: number) => void;

/**
 * Draggable handles over the preview, one per NiTeX box. Positions map directly
 * from the 0..100 plane (origin bottom-left, y up): left=x%, top=(100-y)%,
 * width=w%. Dragging updates locally for smoothness and commits one op on release.
 */
export function NiboxOverlay({
  niboxes,
  onMove,
  onResize,
}: {
  niboxes: NiboxInfo[];
  onMove: Move;
  onResize: Resize;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {niboxes.map((b) => (
        <NiboxHandle key={b.index} box={b} onMove={onMove} onResize={onResize} />
      ))}
    </div>
  );
}

function NiboxHandle({
  box,
  onMove,
  onResize,
}: {
  box: NiboxInfo;
  onMove: Move;
  onResize: Resize;
}) {
  const [local, setLocal] = useState({ x: box.x, y: box.y, w: box.w });
  const ref = useRef<HTMLDivElement>(null);

  // Re-sync when the deck recompiles with new coordinates.
  useEffect(() => setLocal({ x: box.x, y: box.y, w: box.w }), [box.x, box.y, box.w]);

  const drag = (e: React.PointerEvent, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    const parent = ref.current?.parentElement?.getBoundingClientRect();
    if (!parent) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const orig = { x: box.x, y: box.y, w: box.w };
    let last = orig;
    const onPointerMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - sx) / parent.width) * 100;
      const dy = ((ev.clientY - sy) / parent.height) * 100;
      last =
        mode === 'move'
          ? { ...orig, x: clamp(orig.x + dx), y: clamp(orig.y - dy) }
          : { ...orig, w: Math.max(5, Math.min(100, orig.w + dx)) };
      setLocal(last);
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (mode === 'move') onMove(box.index, last.x, last.y);
      else onResize(box.index, last.w);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div
      ref={ref}
      data-nibox={box.index}
      onPointerDown={(e) => drag(e, 'move')}
      style={{ left: `${local.x}%`, top: `${100 - local.y}%`, width: `${local.w}%` }}
      className="pointer-events-auto absolute flex min-h-5 cursor-move items-start rounded-[3px] border-2 border-brand/70 border-dashed bg-brand/5 px-1 py-0.5 hover:bg-brand/10"
    >
      <span className="pointer-events-none truncate text-[10px] text-brand/90 leading-snug">
        {box.text || 'caixa'}
      </span>
      <button
        type="button"
        title="Redimensionar"
        onPointerDown={(e) => drag(e, 'resize')}
        className="-right-1.5 -bottom-1.5 absolute size-3 cursor-nwse-resize rounded-[2px] border border-white bg-brand"
      />
    </div>
  );
}
