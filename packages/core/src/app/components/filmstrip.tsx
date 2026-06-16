import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { PdfCanvas, type PdfDoc } from '../lib/pdf';

const RAIL_W = 156;

/**
 * Left rail of slide thumbnails — click to jump (current page highlighted), and drag a
 * thumbnail onto another to reorder (when `onReorder` is given).
 */
export function Filmstrip({
  doc,
  page,
  count,
  onSelect,
  onReorder,
}: {
  doc: PdfDoc | null;
  page: number;
  count: number;
  onSelect: (page: number) => void;
  onReorder?: (from: number, to: number) => void;
}) {
  // Source index lives in a ref so `drop` reads it synchronously (no re-render in between).
  const dragFrom = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const draggable = Boolean(onReorder);

  return (
    <aside
      className="flex h-full shrink-0 flex-col border-hairline border-r bg-sidebar"
      style={{ width: RAIL_W }}
    >
      <header className="flex h-9 shrink-0 items-center gap-2 border-hairline border-b px-3">
        <span className="font-heading text-[12px] font-semibold tracking-tight">Slides</span>
        <span className="folio ml-auto">{count}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {Array.from({ length: count }, (_, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: thumbnails are positional by page index
            key={i}
            type="button"
            draggable={draggable}
            onClick={() => onSelect(i)}
            onDragStart={() => {
              dragFrom.current = i;
              setDragging(i);
            }}
            onDragEnd={() => {
              dragFrom.current = null;
              setDragging(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              if (dragFrom.current !== null) {
                e.preventDefault();
                setOver(i);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragFrom.current;
              if (from !== null && from !== i) onReorder?.(from, i);
              dragFrom.current = null;
              setDragging(null);
              setOver(null);
            }}
            className={cn(
              'relative w-full overflow-hidden rounded-md border bg-white transition-colors',
              i === page
                ? 'border-brand ring-1 ring-brand/40'
                : 'border-hairline hover:border-brand/50',
              dragging === i && 'opacity-40',
              over === i && dragging !== i && 'ring-2 ring-brand',
            )}
          >
            <div className="aspect-video w-full">
              {doc && <PdfCanvas doc={doc} page={i + 1} canvasClassName="" />}
            </div>
            <span className="folio absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[10px] text-white">
              {i + 1}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
