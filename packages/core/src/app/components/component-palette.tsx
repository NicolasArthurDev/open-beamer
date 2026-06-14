import { Shapes } from 'lucide-react';
import { COMPONENTS, type ComponentDef } from '../lib/components';
import { useEdit } from '../lib/use-edit';
import { usePanelMount } from './panel/panel-shell';
import { ScrollArea } from './ui/scroll-area';

const RAIL_W = 200;
const TRANSITION_MS = 240;

function groupByCategory(items: ComponentDef[]): [string, ComponentDef[]][] {
  const map = new Map<string, ComponentDef[]>();
  for (const c of items) {
    const list = map.get(c.category) ?? [];
    list.push(c);
    map.set(c.category, list);
  }
  return [...map.entries()];
}

export function ComponentPalette({
  deckId,
  open,
  selectedFrame,
}: {
  deckId: string;
  open: boolean;
  selectedFrame: number;
}) {
  const edit = useEdit(deckId);
  const { mounted, animVisible } = usePanelMount(open);
  if (!mounted) return null;

  const insert = (c: ComponentDef) => {
    if (c.target === 'deck') {
      void edit({ kind: 'addFrame', snippet: c.snippet, afterIndex: selectedFrame });
    } else {
      void edit({ kind: 'insert', frameIndex: selectedFrame, snippet: c.snippet });
    }
  };

  return (
    <aside
      className="flex h-full shrink-0 overflow-hidden bg-sidebar transition-[width,border-right-width] ease-out"
      style={{
        width: animVisible ? RAIL_W : 0,
        borderRightWidth: animVisible ? 1 : 0,
        borderRightColor: 'var(--hairline)',
        transitionDuration: `${TRANSITION_MS}ms`,
      }}
    >
      <div style={{ width: RAIL_W }} className="flex h-full shrink-0 flex-col">
        <header className="flex h-9 shrink-0 items-center gap-2 border-b border-hairline px-3">
          <Shapes className="size-3.5 text-muted-foreground" />
          <span className="font-heading text-[12px] font-semibold tracking-tight">Componentes</span>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-3 p-2">
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
        </ScrollArea>
      </div>
    </aside>
  );
}
