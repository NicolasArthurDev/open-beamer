import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { NiComponent } from '../lib/use-outline';

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const clampW = (v: number) => Math.max(5, Math.min(100, v));
const SNAP = 1.2; // snap threshold in the 0..100 plane

type Change = (index: number, x: number, y: number, w: number) => void;
type Guides = { x: number[]; y: number[] };
type Mode = 'move' | 'resize-e' | 'resize-w';

const nearest = (value: number, targets: number[]) => {
  let best: { delta: number; at: number } | null = null;
  for (const t of targets) {
    const d = t - value;
    if (Math.abs(d) <= SNAP && (!best || Math.abs(d) < Math.abs(best.delta)))
      best = { delta: d, at: t };
  }
  return best;
};

/**
 * Draggable handles over the preview, one per NiTeX component. Click to select;
 * drag the body to move, the side handles to change width (text rewraps). While
 * dragging, edges/centers snap to other components and slide guides (Canva-style),
 * and guide lines are drawn. One op committed on release.
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
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  return (
    <div className="absolute inset-0" onPointerDown={() => onSelect(null)}>
      {guides.x.map((gx) => (
        <div
          key={`gx-${gx}`}
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-brand/80"
          style={{ left: `${gx}%` }}
        />
      ))}
      {guides.y.map((gy) => (
        <div
          key={`gy-${gy}`}
          className="pointer-events-none absolute right-0 left-0 h-px bg-brand/80"
          style={{ top: `${100 - gy}%` }}
        />
      ))}
      {niComponents.map((c) => (
        <NiHandle
          key={c.index}
          box={c}
          others={niComponents.filter((o) => o.index !== c.index)}
          selected={selected === c.index}
          onSelect={() => onSelect(c.index)}
          onChange={onChange}
          onGuides={setGuides}
        />
      ))}
    </div>
  );
}

function NiHandle({
  box,
  others,
  selected,
  onSelect,
  onChange,
  onGuides,
}: {
  box: NiComponent;
  others: NiComponent[];
  selected: boolean;
  onSelect: () => void;
  onChange: Change;
  onGuides: (g: Guides) => void;
}) {
  const [local, setLocal] = useState({ x: box.x, y: box.y, w: box.w });
  const ref = useRef<HTMLDivElement>(null);

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
    // Snap targets: every other component's edges/center + the slide thirds.
    const xT = [0, 50, 100, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
    const yT = [0, 50, 100, ...others.map((o) => o.y)];
    let last = orig;

    const onPointerMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - sx) / parent.width) * 100;
      const dy = ((ev.clientY - sy) / parent.height) * 100;
      const g: Guides = { x: [], y: [] };

      if (mode === 'move') {
        let x = clamp(orig.x + dx);
        let y = clamp(orig.y - dy);
        // snap whichever of left/center/right is closest to a target
        const sX = [x, x + orig.w / 2, x + orig.w]
          .map((v) => nearest(v, xT))
          .filter((s): s is { delta: number; at: number } => s !== null)
          .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
        if (sX) {
          x = clamp(x + sX.delta);
          g.x = [sX.at];
        }
        const sY = nearest(y, yT);
        if (sY) {
          y = clamp(y + sY.delta);
          g.y = [sY.at];
        }
        last = { x, y, w: orig.w };
      } else if (mode === 'resize-e') {
        let w = clampW(orig.w + dx);
        const s = nearest(orig.x + w, xT);
        if (s) {
          w = clampW(s.at - orig.x);
          g.x = [s.at];
        }
        last = { ...orig, w };
      } else {
        // resize-w: move the left edge (right edge stays at orig.x + orig.w)
        let x = clamp(orig.x + dx);
        const s = nearest(x, xT);
        if (s) {
          x = clamp(s.at);
          g.x = [s.at];
        }
        last = { x, y: orig.y, w: clampW(orig.x + orig.w - x) };
      }
      setLocal(last);
      onGuides(g);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      onGuides({ x: [], y: [] });
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
