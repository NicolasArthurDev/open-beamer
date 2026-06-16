import {
  Bold,
  ChevronDown,
  ChevronUp,
  Copy,
  Minus,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useEdit } from '../lib/use-edit';
import { useOutline } from '../lib/use-outline';
import { Field, Section } from './panel/panel-fields';
import { PanelShell, usePanelMount } from './panel/panel-shell';
import { Button } from './ui/button';
import { Input } from './ui/input';

const SIZES = [
  'tiny',
  'scriptsize',
  'footnotesize',
  'small',
  'normalsize',
  'large',
  'Large',
  'LARGE',
  'huge',
  'Huge',
] as const;
const COLORS = ['black', 'red', 'blue', 'teal', 'orange', 'gray'];

function Swatch({ color, onClick }: { color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={color}
      onClick={onClick}
      className="size-4 rounded-full ring-1 ring-black/25 transition-transform hover:scale-110"
      style={{ background: color }}
    />
  );
}

/** The inspector follows the active slide (`active` = the frame shown in the preview). */
export function EditPanel({
  deckId,
  open,
  active,
}: {
  deckId: string;
  open: boolean;
  active: number;
}) {
  const { frames } = useOutline(deckId);
  const edit = useEdit(deckId);
  const [sizeIdx, setSizeIdx] = useState(4);
  const [runSizes, setRunSizes] = useState<Record<string, number>>({});
  const { mounted, animVisible } = usePanelMount(open);

  if (!mounted) return null;

  const sel = Math.max(0, Math.min(active, frames.length - 1));
  const frame = frames[sel];

  const commitTitle = (value: string) => {
    if (frame) void edit({ kind: 'title', frameIndex: frame.index, value });
  };
  const commitText = (prevText: string, value: string) => {
    if (frame && value !== prevText)
      void edit({ kind: 'text', frameIndex: frame.index, prevText, value });
  };
  const stepSize = (delta: number) => {
    if (!frame) return;
    const next = Math.max(0, Math.min(SIZES.length - 1, sizeIdx + delta));
    setSizeIdx(next);
    void edit({ kind: 'fontSize', frameIndex: frame.index, size: SIZES[next] });
  };
  const stepRun = (runText: string, delta: number) => {
    if (!frame) return;
    const next = Math.max(0, Math.min(SIZES.length - 1, (runSizes[runText] ?? 4) + delta));
    setRunSizes((m) => ({ ...m, [runText]: next }));
    void edit({ kind: 'runFontSize', frameIndex: frame.index, runText, size: SIZES[next] });
  };

  return (
    <PanelShell
      uiAttr="inspector"
      animVisible={animVisible}
      header={
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          <span className="font-heading text-[12px] font-semibold tracking-tight">Inspector</span>
          {frame && <span className="folio ml-auto">slide {sel + 1}</span>}
        </div>
      }
    >
      {!frame ? (
        <div className="px-3.5 py-6 text-[12px] text-muted-foreground">Sem slide.</div>
      ) : (
        <>
          <Section title="Título">
            <Input
              key={`title-${frame.index}-${frame.title}`}
              defaultValue={frame.title}
              onBlur={(e) => commitTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </Section>

          {frame.texts.length > 0 && (
            <Section title="Texto">
              {frame.texts.map((t, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: text runs can repeat; index keeps fields stable
                <div className="flex flex-col gap-1.5" key={`text-${frame.index}-${i}-${t}`}>
                  <Input
                    defaultValue={t}
                    onBlur={(e) => commitText(t, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      title="negrito"
                      onClick={() => edit({ kind: 'runBold', frameIndex: frame.index, runText: t })}
                    >
                      <Bold className="size-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      title="menor"
                      onClick={() => stepRun(t, -1)}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      title="maior"
                      onClick={() => stepRun(t, 1)}
                    >
                      <Plus className="size-3" />
                    </Button>
                    {COLORS.map((c) => (
                      <Swatch
                        key={c}
                        color={c}
                        onClick={() =>
                          edit({ kind: 'runColor', frameIndex: frame.index, runText: t, color: c })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {frame.components.length > 0 && (
            <Section title="Componentes">
              {frame.components.map((c) => (
                <div
                  className="flex items-center justify-between gap-2"
                  key={`comp-${frame.index}-${c.index}`}
                >
                  <span className="text-[12px] text-muted-foreground">{c.label}</span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    title="excluir componente"
                    className="text-destructive"
                    onClick={() =>
                      edit({
                        kind: 'deleteComponent',
                        frameIndex: frame.index,
                        componentIndex: c.index,
                      })
                    }
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </Section>
          )}

          <Section title="Frame">
            <Field label="Fonte">
              <Button variant="outline" size="icon-sm" onClick={() => stepSize(-1)}>
                <Minus className="size-3" />
              </Button>
              <Button variant="outline" size="icon-sm" onClick={() => stepSize(1)}>
                <Plus className="size-3" />
              </Button>
            </Field>
            <Field label="Cor">
              {COLORS.map((c) => (
                <Swatch
                  key={c}
                  color={c}
                  onClick={() => edit({ kind: 'color', frameIndex: frame.index, color: c })}
                />
              ))}
            </Field>
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
        </>
      )}
    </PanelShell>
  );
}
