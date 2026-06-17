import { NI_COMPONENTS } from '@nitex/nitex';
import { ChevronDown, ChevronUp, Copy, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useEdit } from '../lib/use-edit';
import { useOutline } from '../lib/use-outline';
import { NumberField, Section } from './panel/panel-fields';
import { PanelShell, usePanelMount } from './panel/panel-shell';
import { Button } from './ui/button';
import { Input } from './ui/input';

/** Field labels per ni component type, for the inspector. */
const NI_SPEC = new Map(NI_COMPONENTS.map((c) => [c.type, c]));

/**
 * Selection-driven inspector. With a component selected it shows only that
 * component's controls (content, format, position, actions); otherwise a slim
 * slide view (title + slide actions).
 */
export function EditPanel({
  deckId,
  open,
  active,
  selected,
  onSelect,
}: {
  deckId: string;
  open: boolean;
  active: number;
  selected: number | null;
  onSelect: (index: number | null) => void;
}) {
  const { frames } = useOutline(deckId);
  const edit = useEdit(deckId);
  const { mounted, animVisible } = usePanelMount(open);

  if (!mounted) return null;

  const sel = Math.max(0, Math.min(active, frames.length - 1));
  const frame = frames[sel];
  const comp = selected != null ? frame?.niComponents[selected] : undefined;

  const header = (
    <div className="flex items-center gap-2">
      <SlidersHorizontal className="size-3.5 text-muted-foreground" />
      <span className="font-heading text-[12px] font-semibold tracking-tight">Inspector</span>
      <span className="folio ml-auto">
        {comp ? (NI_SPEC.get(comp.type)?.label ?? comp.type) : frame ? `slide ${sel + 1}` : ''}
      </span>
    </div>
  );

  if (!frame) {
    return (
      <PanelShell uiAttr="inspector" animVisible={animVisible} header={header}>
        <div className="px-3.5 py-6 text-[12px] text-muted-foreground">Sem slide.</div>
      </PanelShell>
    );
  }

  if (comp) {
    return (
      <PanelShell uiAttr="inspector" animVisible={animVisible} header={header}>
        <Section title="Conteúdo">
          {comp.fields.map((val, fi) => (
            <Input
              // biome-ignore lint/suspicious/noArrayIndexKey: fields are positional per type
              key={`ni-${frame.index}-${comp.index}-${fi}-${val}`}
              defaultValue={val}
              placeholder={NI_SPEC.get(comp.type)?.fields[fi]?.label}
              onBlur={(e) => {
                if (e.target.value !== val)
                  edit({
                    kind: 'setNiField',
                    frameIndex: frame.index,
                    index: comp.index,
                    fieldIndex: fi,
                    value: e.target.value,
                  });
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          ))}
        </Section>

        <Section title="Posição">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              x
              <NumberField
                value={comp.x}
                min={0}
                max={100}
                onChange={(x) =>
                  edit({
                    kind: 'moveNiComponent',
                    frameIndex: frame.index,
                    index: comp.index,
                    x,
                    y: comp.y,
                  })
                }
              />
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              y
              <NumberField
                value={comp.y}
                min={0}
                max={100}
                onChange={(y) =>
                  edit({
                    kind: 'moveNiComponent',
                    frameIndex: frame.index,
                    index: comp.index,
                    x: comp.x,
                    y,
                  })
                }
              />
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              L
              <NumberField
                value={comp.w}
                min={5}
                max={100}
                onChange={(w) =>
                  edit({ kind: 'resizeNiComponent', frameIndex: frame.index, index: comp.index, w })
                }
              />
            </span>
          </div>
        </Section>

        <Section title="Ações">
          <div className="flex flex-wrap gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                edit({ kind: 'duplicateNiComponent', frameIndex: frame.index, index: comp.index })
              }
            >
              <Copy className="mr-1 size-3" />
              Duplicar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => {
                void edit({
                  kind: 'deleteNiComponent',
                  frameIndex: frame.index,
                  index: comp.index,
                });
                onSelect(null);
              }}
            >
              <Trash2 className="mr-1 size-3" />
              Excluir
            </Button>
          </div>
        </Section>
      </PanelShell>
    );
  }

  // No component selected: slim slide view.
  return (
    <PanelShell uiAttr="inspector" animVisible={animVisible} header={header}>
      <Section title="Slide">
        <Input
          key={`title-${frame.index}-${frame.title}`}
          defaultValue={frame.title}
          placeholder="Título do slide"
          onBlur={(e) => edit({ kind: 'title', frameIndex: frame.index, value: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <div className="flex flex-wrap gap-1 pt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={sel <= 0}
            onClick={() => edit({ kind: 'reorder', from: sel, to: sel - 1 })}
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={sel >= frames.length - 1}
            onClick={() => edit({ kind: 'reorder', from: sel, to: sel + 1 })}
          >
            <ChevronDown className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => edit({ kind: 'duplicate', frameIndex: frame.index })}
          >
            <Copy className="mr-1 size-3" />
            Duplicar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => edit({ kind: 'delete', frameIndex: frame.index })}
          >
            <Trash2 className="mr-1 size-3" />
            Excluir
          </Button>
        </div>
      </Section>
      <div className="px-3.5 pb-4 text-[11px] text-muted-foreground leading-relaxed">
        Clique num componente para editá-lo, ou use <strong>Inserir</strong> para adicionar um.
      </div>
    </PanelShell>
  );
}
