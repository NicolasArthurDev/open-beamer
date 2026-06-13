import { Presentation } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/card';

type Deck = { id: string };

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
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-hairline bg-sidebar/85 px-4 backdrop-blur-md">
        <Presentation className="size-4 text-brand" />
        <span className="font-heading text-[13px] font-semibold tracking-tight">open-beamer</span>
        <span className="eyebrow ml-1">beamer, sem a dor</span>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-6 py-10">
        <h1 className="font-heading text-lg font-semibold tracking-tight">Apresentações</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {decks.length} {decks.length === 1 ? 'deck' : 'decks'} em <code>presentations/</code>
        </p>

        {decks.length === 0 ? (
          <p className="mt-10 text-[13px] text-muted-foreground">
            Nenhum deck ainda. Crie <code>presentations/&lt;id&gt;/main.tex</code>.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((d) => (
              <Link key={d.id} to={`/d/${d.id}`} className="group">
                <Card className="overflow-hidden p-0 transition-colors hover:border-brand/50">
                  <div className="grid aspect-video place-items-center bg-canvas">
                    <Presentation className="size-7 text-muted-foreground/50 transition-colors group-hover:text-brand/70" />
                  </div>
                  <div className="border-t border-hairline px-3 py-2">
                    <span className="truncate text-[13px] font-medium">{d.id}</span>
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
