import { Plus, Presentation } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { loadPdf, PdfCanvas, type PdfDoc } from '../lib/pdf';

type Deck = { id: string };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

/** Renders a deck's first slide as a cover, falling back to an icon while it compiles. */
function DeckThumb({ id }: { id: string }) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/__pdf/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('compile failed'))))
      .then(loadPdf)
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!doc) {
    return (
      <Presentation className="size-7 text-muted-foreground/50 transition-colors group-hover:text-brand/70" />
    );
  }
  return <PdfCanvas doc={doc} page={1} canvasClassName="" />;
}

/** "Novo documento" — names a deck, scaffolds it from the starter template, opens it. */
function NewDocButton() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = slugify(name);

  const create = async () => {
    if (!id) {
      setError('Dê um nome ao documento.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/__new', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, title: name.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; id?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'não foi possível criar');
        setBusy(false);
        return;
      }
      setOpen(false);
      navigate(`/d/${data.id}`);
    } catch {
      setError('erro de rede');
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName('');
          setError(null);
          setBusy(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="brand" size="sm">
          <Plus className="mr-1 size-3.5" />
          Novo documento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo documento</DialogTitle>
          <DialogDescription>Cria uma apresentação a partir de um modelo básico.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Input
            autoFocus
            placeholder="Nome da apresentação"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void create();
            }}
          />
          {id && (
            <p className="text-[12px] text-muted-foreground">
              id: <code>{id}</code>
            </p>
          )}
          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="brand" size="sm" disabled={busy || !id} onClick={() => void create()}>
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Home() {
  const [decks, setDecks] = useState<Deck[]>([]);

  useEffect(() => {
    void fetch('/__decks')
      .then((r) => r.json() as Promise<{ decks: Deck[] }>)
      .then((d) => setDecks(d.decks))
      .catch(() => setDecks([]));
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-2 border-hairline border-b bg-sidebar/85 px-4 backdrop-blur-md">
        <Presentation className="size-4 text-brand" />
        <span className="font-heading font-semibold text-[13px] tracking-tight">open-beamer</span>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading font-semibold text-lg tracking-tight">Apresentações</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {decks.length} {decks.length === 1 ? 'deck' : 'decks'} em <code>presentations/</code>
            </p>
          </div>
          <NewDocButton />
        </div>

        {decks.length === 0 ? (
          <p className="mt-10 text-[13px] text-muted-foreground">
            Nenhum deck ainda. Crie um com <strong>Novo documento</strong>.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((d) => (
              <Link key={d.id} to={`/d/${d.id}`} className="group">
                <Card className="overflow-hidden p-0 transition-colors hover:border-brand/50">
                  <div className="grid aspect-video place-items-center overflow-hidden bg-canvas">
                    <DeckThumb id={d.id} />
                  </div>
                  <div className="border-hairline border-t px-3 py-2">
                    <span className="truncate font-medium text-[13px]">{d.id}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
