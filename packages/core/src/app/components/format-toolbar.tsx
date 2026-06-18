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
// Quick-pick swatches (hex); the color well next to them picks any color.
const SWATCHES = ['#1A1A1A', '#E5484D', '#2563EB', '#0D9488', '#F59E0B', '#8E8E93'];
const ALIGNS = [
  { value: 'left', icon: AlignLeft },
  { value: 'center', icon: AlignCenter },
  { value: 'right', icon: AlignRight },
] as const;
const FONTS = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
];

type StyleKind = 'size' | 'color' | 'bold' | 'align' | 'font';

const Divider = () => <span className="mx-0.5 h-4 w-px bg-hairline" />;
const isHex = (c?: string) => !!c && /^#[0-9a-fA-F]{6}$/.test(c);

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
      <select
        aria-label="Fonte"
        value={style.font ?? 'sans'}
        onChange={(e) => onStyle('font', e.target.value)}
        className="h-7 rounded-[5px] border border-border bg-background px-1.5 text-[12px] outline-none"
      >
        {FONTS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
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
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onStyle('color', c)}
          className="size-4 rounded-full ring-1 ring-black/25 transition-transform hover:scale-110"
          style={{ background: c }}
        />
      ))}
      <label
        title="Qualquer cor"
        className="relative size-5 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/25"
        style={{
          background: 'conic-gradient(red, orange, yellow, lime, aqua, blue, magenta, red)',
        }}
      >
        <input
          type="color"
          value={isHex(style.color) ? (style.color as string) : '#000000'}
          onChange={(e) => onStyle('color', e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
