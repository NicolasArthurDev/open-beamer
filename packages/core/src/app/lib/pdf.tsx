import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef } from 'react';

GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDoc = PDFDocumentProxy;

export async function loadPdf(data: ArrayBuffer): Promise<PdfDoc> {
  return await getDocument({ data }).promise;
}

export type PickInfo = { page: number; x: number; y: number };

/** Renders a single PDF page into a canvas, scaled to fit its container. */
export function PdfCanvas({
  doc,
  page,
  onPick,
}: {
  doc: PdfDoc;
  page: number;
  onPick?: (info: PickInfo) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const fitRef = useRef(1);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let cancelled = false;
    let task: RenderTask | null = null;

    const render = async () => {
      const rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const p = await doc.getPage(page);
      if (cancelled) return;
      pageRef.current = p;
      const base = p.getViewport({ scale: 1 });
      const fit = Math.min(rect.width / base.width, rect.height / base.height);
      fitRef.current = fit;
      const dpr = window.devicePixelRatio || 1;
      const viewport = p.getViewport({ scale: fit * dpr });
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(base.width * fit)}px`;
      canvas.style.height = `${Math.floor(base.height * fit)}px`;
      task?.cancel();
      task = p.render({ canvasContext: ctx, viewport });
      try {
        await task.promise;
      } catch {
        // render cancelled by a newer one — ignore
      }
    };

    void render();
    const ro = new ResizeObserver(() => void render());
    ro.observe(wrap);
    return () => {
      cancelled = true;
      task?.cancel();
      ro.disconnect();
    };
  }, [doc, page]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pageProxy = pageRef.current;
    if (!onPick || !pageProxy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const viewport = pageProxy.getViewport({ scale: fitRef.current });
    const [x, y] = viewport.convertToPdfPoint(e.clientX - rect.left, e.clientY - rect.top);
    onPick({ page, x, y });
  };

  return (
    <div ref={wrapRef} className="pdf-stage">
      <canvas
        ref={canvasRef}
        onClick={onPick ? handleClick : undefined}
        style={{ cursor: onPick ? 'crosshair' : 'default' }}
      />
    </div>
  );
}
