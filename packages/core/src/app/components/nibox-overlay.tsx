import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { NiComponent } from '../lib/use-outline';

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const clampW = (v: number) => Math.max(5, Math.min(100, v));

type Change = (index: number, x: number, y: number, w: number) => void;
type Mode = 'move' | 'resize-e' | 'resize-w';

/**
 * Draggable handles over the preview, one per NiTeX component. Positions map
 * directly from the 0..100 plane (origin bottom-left, y up): left=x%, top=(100-y)%,
 * width=w%. Click to select; drag the body to move, the side handles to change
 * width (so the text rewraps). One op committed on release.
 */
export function NiboxOverlay({
  niComponents,
  selected,
  onSelect,
  onChange,
}: {
  niComponents: NiComponent[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  onChange: Change;
}) {
  return (
    <div className="absolute inset-0" onPointerDown={() => onSelect(null)}>
      {niComponents.map((c) => (
        <NiHandle
          key={c.index}
          box={c}
          selected={selected === c.index}
          onSelect={() => onSelect(c.index)}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function NiHandle({
  box,
  selected,
  onSelect,
  onChange,
}: {
  box: NiComponent;
  selected: boolean;
  onSelect: () => void;
  onChange: Change;
}) {
  const [local, setLocal] = useState({ x: box.x, y: box.y, w: box.w });
  const ref = useRef<HTMLDivElement>(null);

  // Re-sync when the deck recompiles with new coordinates.
  useEffect(() => setLocal({ x: box.x, y: box.y, w: box.w }), [box.x, box.y, box.w]);

  const drag = (e: React.PointerEvent, mode: Mode) => {
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
      if (mode === 'move') last = { x: clamp(orig.x + dx), y: clamp(orig.y - dy), w: orig.w };
      else if (mode === 'resize-e') last = { ...orig, w: clampW(orig.w + dx) };
      else last = { ...orig, x: clamp(orig.x + dx), w: clampW(orig.w - dx) }; // resize-w
      setLocal(last);
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (last.x !== orig.x || last.y !== orig.y || last.w !== orig.w)
        onChange(box.index, last.x, last.y, last.w);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const edge =
    'absolute top-1/2 z-10 h-6 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-full border border-white bg-brand';

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
        <>
          <button
            type="button"
            title="Largura"
            onPointerDown={(e) => drag(e, 'resize-w')}
            className={cn(edge, '-left-1')}
          />
          <button
            type="button"
            title="Largura"
            onPointerDown={(e) => drag(e, 'resize-e')}
            className={cn(edge, '-right-1')}
          />
        </>
      )}
    </div>
  );
}
