import { useCallback, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PdfCanvas } from '../lib/pdf';
import { useDeck } from '../lib/use-deck';

export function Viewer() {
  const { id = '' } = useParams();
  const { doc, error, loading } = useDeck(id);
  const [params, setParams] = useSearchParams();

  const pageCount = doc?.numPages ?? 1;
  const raw = Number(params.get('p') ?? '1') - 1;
  const page = Number.isFinite(raw) ? Math.max(0, Math.min(pageCount - 1, raw)) : 0;

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goTo(page + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goTo(page - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, goTo]);

  return (
    <div className="viewer">
      <header className="bar">
        <Link to="/" className="back">
          ← decks
        </Link>
        <span className="title">{id}</span>
        <span className="spacer" />
        {doc && !error && (
          <span className="pageno">
            {page + 1} / {pageCount}
          </span>
        )}
        <Link to={`/d/${id}/present?p=${page + 1}`} className="present-link">
          Present
        </Link>
      </header>
      <main className="stage-area">
        {error ? (
          <pre className="error-panel">{error}</pre>
        ) : doc ? (
          <PdfCanvas doc={doc} page={page + 1} />
        ) : (
          <p className="muted">{loading ? 'compiling…' : 'no preview'}</p>
        )}
      </main>
      {doc && !error && (
        <footer className="nav">
          <button type="button" onClick={() => goTo(page - 1)} disabled={page <= 0}>
            Prev
          </button>
          <button type="button" onClick={() => goTo(page + 1)} disabled={page >= pageCount - 1}>
            Next
          </button>
        </footer>
      )}
    </div>
  );
}
