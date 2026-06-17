import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Play,
  Redo2,
  Undo2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ComponentPalette } from '../components/component-palette';
import { EditPanel } from '../components/edit-panel';
import { Filmstrip } from '../components/filmstrip';
import { NiboxOverlay } from '../components/nibox-overlay';
import { Button } from '../components/ui/button';
import { PdfCanvas } from '../lib/pdf';
import { useDeck } from '../lib/use-deck';
import { useEdit, useHistory } from '../lib/use-edit';
import { useOutline } from '../lib/use-outline';
import { usePageMap } from '../lib/use-pagemap';

export function Viewer() {
  const { id = '' } = useParams();
  const { doc, error, loading } = useDeck(id);
  const { frameForPage } = usePageMap(id);
  const { undo, redo } = useHistory(id);
  const edit = useEdit(id);
  const { frames } = useOutline(id);
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  // The selected NiTeX component (index within the active frame), or null.
  const [selected, setSelected] = useState<number | null>(null);

  const pageCount = doc?.numPages ?? 1;
  const raw = Number(params.get('p') ?? '1') - 1;
  const page = Number.isFinite(raw) ? Math.max(0, Math.min(pageCount - 1, raw)) : 0;
  // The inspector + palette follow the slide currently shown in the preview.
  const activeFrame = frameForPage(page + 1);
  const niComponents = frames[activeFrame]?.niComponents ?? [];

  // Selection is per-slide; drop it when the visible slide changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the slide changes
  useEffect(() => setSelected(null), [activeFrame]);

  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(pageCount - 1, i));
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('p', String(clamped + 1));
          return next;
        },
        { replace: true },
      );
    },
    [pageCount, setParams],
  );

  // Drag a thumbnail onto another → reorder the underlying frames (page→frame via the map).
  const reorderByPage = useCallback(
    (fromPage: number, toPage: number) => {
      const from = frameForPage(fromPage + 1);
      const to = frameForPage(toPage + 1);
      if (from !== to) {
        void edit({ kind: 'reorder', from, to });
        goTo(toPage);
      }
    },
    [frameForPage, edit, goTo],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void (e.shiftKey ? redo() : undo());
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        void redo();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goTo(page + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goTo(page - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, goTo, undo, redo]);

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-hairline bg-sidebar/85 px-2 backdrop-blur-md md:px-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="mr-1 size-3.5" />
            decks
          </Link>
        </Button>
        <span className="font-heading text-[13px] font-semibold tracking-tight">{id}</span>
        <span className="flex-1" />
        {editing && (
          <>
            <ComponentPalette deckId={id} activeFrame={activeFrame} />
            <Button
              variant="ghost"
              size="icon-sm"
              title="Desfazer (Ctrl+Z)"
              onClick={() => void undo()}
            >
              <Undo2 className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Refazer (Ctrl+Shift+Z)"
              onClick={() => void redo()}
            >
              <Redo2 className="size-3.5" />
            </Button>
          </>
        )}
        <Button
          variant={editing ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setEditing((v) => !v)}
        >
          <Pencil className="mr-1 size-3.5" />
          Editar
        </Button>
        <Button asChild variant="brand" size="sm">
          <Link to={`/d/${id}/present?p=${page + 1}`}>
            <Play className="mr-1 size-3.5" />
            Apresentar
          </Link>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <Filmstrip
          doc={doc}
          page={page}
          count={pageCount}
          onSelect={goTo}
          onReorder={reorderByPage}
        />
        <main className="paper relative min-h-0 min-w-0 flex-1 bg-canvas">
          <div className="absolute inset-0 p-6">
            {error ? (
              <div className="grid h-full place-items-center">
                <pre className="max-h-full max-w-2xl overflow-auto whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-4 text-[12px] text-destructive">
                  {error}
                </pre>
              </div>
            ) : doc ? (
              <PdfCanvas
                doc={doc}
                page={page + 1}
                onActivate={editing ? undefined : () => setEditing(true)}
                overlay={
                  editing ? (
                    <NiboxOverlay
                      niComponents={niComponents}
                      selected={selected}
                      onSelect={setSelected}
                      onMove={(i, x, y) =>
                        edit({ kind: 'moveNiComponent', frameIndex: activeFrame, index: i, x, y })
                      }
                      onResize={(i, w) =>
                        edit({ kind: 'resizeNiComponent', frameIndex: activeFrame, index: i, w })
                      }
                    />
                  ) : undefined
                }
              />
            ) : (
              <div className="grid h-full place-items-center">
                <p className="text-[13px] text-muted-foreground">
                  {loading ? 'compilando…' : 'sem preview'}
                </p>
              </div>
            )}
          </div>

          {loading && doc && !error && (
            <div className="-translate-x-1/2 absolute top-4 left-1/2 flex items-center gap-2 rounded-full border border-hairline bg-sidebar/90 px-3 py-1.5 shadow-floating backdrop-blur-md">
              <Loader2 className="size-3.5 animate-spin text-brand" />
              <span className="text-[12px] text-muted-foreground">compilando…</span>
            </div>
          )}

          {doc && !error && (
            <div className="-translate-x-1/2 absolute bottom-4 left-1/2 flex items-center gap-1 rounded-full border border-hairline bg-sidebar/90 px-1.5 py-1 shadow-floating backdrop-blur-md">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={page <= 0}
                onClick={() => goTo(page - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="folio min-w-12 px-1 text-center">
                {page + 1} / {pageCount}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={page >= pageCount - 1}
                onClick={() => goTo(page + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </main>

        <EditPanel
          deckId={id}
          open={editing}
          active={activeFrame}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    </div>
  );
}
