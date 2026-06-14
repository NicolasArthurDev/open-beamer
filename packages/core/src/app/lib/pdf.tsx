import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef } from 'react';

GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDoc = PDFDocumentProxy;

export async function loadPdf(data: ArrayBuffer): Promise<PdfDoc> {
  return await getDocument({ data }).promise;
}

/** Renders a single PDF page into a canvas, scaled to fit its container. */
export function PdfCanvas({ doc, page }: { doc: PdfDoc; page: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      const base = p.getViewport({ scale: 1 });
      const fit = Math.min(rect.width / base.width, rect.height / base.height);
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

  return (
    <div ref={wrapRef} className="grid h-full w-full place-items-center">
      <canvas
        ref={canvasRef}
        className="rounded-sm bg-white shadow-[0_10px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-black/10"
      />
    </div>
  );
}
