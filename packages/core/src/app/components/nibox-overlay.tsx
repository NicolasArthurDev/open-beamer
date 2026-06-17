import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { NiComponent } from '../lib/use-outline';

const clamp = (v: number) => Math.max(0, Math.min(100, v));

type Move = (index: number, x: number, y: number) => void;
type Resize = (index: number, w: number) => void;

/**
 * Draggable handles over the preview, one per NiTeX component. Positions map
 * directly from the 0..100 plane (origin bottom-left, y up): left=x%, top=(100-y)%,
 * width=w%. Click a handle to select it (drag in the same gesture); click empty
 * space to deselect. Dragging updates locally and commits one op on release.
 */
export function NiboxOverlay({
  niComponents,
  selected,
  onSelect,
  onMove,
  onResize,
}: {
  niComponents: NiComponent[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  onMove: Move;
  onResize: Resize;
}) {
  return (
    <div className="absolute inset-0" onPointerDown={() => onSelect(null)}>
      {niComponents.map((c) => (
        <NiHandle
          key={c.index}
          box={c}
          selected={selected === c.index}
          onSelect={() => onSelect(c.index)}
          onMove={onMove}
          onResize={onResize}
        />
      ))}
    </div>
  );
}

function NiHandle({
  box,
  selected,
  onSelect,
  onMove,
  onResize,
}: {
  box: NiComponent;
  selected: boolean;
  onSelect: () => void;
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
    onSelect();
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
      if (mode === 'move' && (last.x !== orig.x || last.y !== orig.y))
        onMove(box.index, last.x, last.y);
      else if (mode === 'resize' && last.w !== orig.w) onResize(box.index, last.w);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div
      ref={ref}
      data-ni={box.index}
      onPointerDown={(e) => drag(e, 'move')}
      style={{ left: `${local.x}%`, top: `${100 - local.y}%`, width: `${local.w}%` }}
      className={cn(
        'pointer-events-auto absolute flex min-h-5 cursor-move items-start rounded-[3px] border-2 px-1 py-0.5',
        selected
          ? 'border-brand border-solid bg-brand/10 ring-2 ring-brand/40'
          : 'border-brand/60 border-dashed bg-brand/5 hover:bg-brand/10',
      )}
    >
      <span className="pointer-events-none truncate text-[10px] text-brand/90 leading-snug">
        {box.fields[0] || box.type}
      </span>
      {selected && (
        <button
          type="button"
          title="Redimensionar"
          onPointerDown={(e) => drag(e, 'resize')}
          className="-right-1.5 -bottom-1.5 absolute size-3 cursor-nwse-resize rounded-[2px] border border-white bg-brand"
        />
      )}
    </div>
  );
}
