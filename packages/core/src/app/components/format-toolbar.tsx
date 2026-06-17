import { AlignCenter, AlignLeft, AlignRight, Bold, Minus, Plus } from 'lucide-react';
import type { NiComponent } from '../lib/use-outline';
import { Button } from './ui/button';

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
const ALIGNS = [
  { value: 'left', icon: AlignLeft },
  { value: 'center', icon: AlignCenter },
  { value: 'right', icon: AlignRight },
] as const;

type StyleKind = 'size' | 'color' | 'bold' | 'align';

const Divider = () => <span className="mx-0.5 h-4 w-px bg-hairline" />;

/** Contextual top toolbar (PowerPoint-style) for the selected component's formatting. */
export function FormatToolbar({
  comp,
  onStyle,
}: {
  comp: NiComponent;
  onStyle: (style: StyleKind, value: string | null) => void;
}) {
  const style = comp.styles[0] ?? {};
  const sizeIdx = style.size ? (SIZES as readonly string[]).indexOf(style.size) : 4;
  const stepSize = (d: number) =>
    onStyle(
      'size',
      SIZES[Math.max(0, Math.min(SIZES.length - 1, (sizeIdx < 0 ? 4 : sizeIdx) + d))],
    );

  return (
    <div className="flex items-center gap-1 rounded-full border border-hairline bg-sidebar/95 px-2 py-1 shadow-floating backdrop-blur-md">
      <Button
        variant="outline"
        size="icon-sm"
        title="negrito"
        data-state={style.bold ? 'on' : undefined}
        onClick={() => onStyle('bold', style.bold ? null : 'on')}
      >
        <Bold className="size-3.5" />
      </Button>
      <Button variant="outline" size="icon-sm" title="menor" onClick={() => stepSize(-1)}>
        <Minus className="size-3.5" />
      </Button>
      <Button variant="outline" size="icon-sm" title="maior" onClick={() => stepSize(1)}>
        <Plus className="size-3.5" />
      </Button>
      <Divider />
      {ALIGNS.map((a) => (
        <Button
          key={a.value}
          variant="outline"
          size="icon-sm"
          title={a.value}
          data-state={style.align === a.value ? 'on' : undefined}
          onClick={() => onStyle('align', a.value)}
        >
          <a.icon className="size-3.5" />
        </Button>
      ))}
      <Divider />
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onStyle('color', c)}
          className="size-4 rounded-full ring-1 ring-black/25 transition-transform hover:scale-110"
          style={{ background: c }}
        />
      ))}
    </div>
  );
}
