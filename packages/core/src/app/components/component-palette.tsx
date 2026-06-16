import { Plus } from 'lucide-react';
import { useState } from 'react';
import { COMPONENTS, type ComponentDef } from '../lib/components';
import { useEdit } from '../lib/use-edit';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

function groupByCategory(items: ComponentDef[]): [string, ComponentDef[]][] {
  const map = new Map<string, ComponentDef[]>();
  for (const c of items) {
    const list = map.get(c.category) ?? [];
    list.push(c);
    map.set(c.category, list);
  }
  return [...map.entries()];
}

/** "Inserir" — a popover palette that adds a component to the active slide (or a new slide). */
export function ComponentPalette({ deckId, activeFrame }: { deckId: string; activeFrame: number }) {
  const edit = useEdit(deckId);
  const [open, setOpen] = useState(false);

  const insert = (c: ComponentDef) => {
    if (c.target === 'deck-start') {
      void edit({ kind: 'addFrame', snippet: c.snippet, afterIndex: -1 });
    } else if (c.target === 'deck') {
      void edit({ kind: 'addFrame', snippet: c.snippet, afterIndex: activeFrame });
    } else {
      void edit({ kind: 'insert', frameIndex: activeFrame, snippet: c.snippet });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus className="mr-1 size-3.5" />
          Inserir
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="flex flex-col gap-3">
          {groupByCategory(COMPONENTS).map(([category, items]) => (
            <div key={category}>
              <span className="eyebrow px-1">{category}</span>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {items.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => insert(c)}
                    className="flex flex-col items-center gap-1 rounded-md border border-hairline bg-card/40 px-2 py-2.5 text-[11px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
                  >
                    <c.icon className="size-4" />
                    <span className="text-center leading-tight">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
