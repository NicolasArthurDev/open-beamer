import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PdfCanvas } from '../lib/pdf';
import { useDeck } from '../lib/use-deck';

export function Present() {
  const { id = '' } = useParams();
  const { doc } = useDeck(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);

  const pageCount = doc?.numPages ?? 1;
  const [page, setPage] = useState(() => Math.max(0, Number(params.get('p') ?? '1') - 1));
  const clamp = useCallback((i: number) => Math.max(0, Math.min(pageCount - 1, i)), [pageCount]);

  useEffect(() => {
    rootRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setPage((p) => clamp(p + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setPage((p) => clamp(p - 1));
      } else if (e.key === 'Escape') {
        navigate(`/d/${id}?p=${page + 1}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clamp, id, navigate, page]);

  return (
    <div ref={rootRef} className="present">
      {doc && <PdfCanvas doc={doc} page={page + 1} />}
    </div>
  );
}
