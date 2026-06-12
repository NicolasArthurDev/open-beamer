import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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
    <div className="home">
      <h1>open-beamer</h1>
      {decks.length === 0 ? (
        <p className="muted">
          No decks found under <code>presentations/</code>.
        </p>
      ) : (
        <ul className="deck-list">
          {decks.map((d) => (
            <li key={d.id}>
              <Link to={`/d/${d.id}`}>{d.id}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
