import { useEffect, useState } from 'react';
import { useEdit } from '../lib/use-edit';
import { useOutline } from '../lib/use-outline';

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
];
const COLORS = ['black', 'red', 'blue', 'teal', 'orange', 'gray'];

export function EditPanel({
  deckId,
  selected,
  onSelect,
}: {
  deckId: string;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const { frames } = useOutline(deckId);
  const edit = useEdit(deckId);
  const [sizeIdx, setSizeIdx] = useState(4); // normalsize
  const [runSizes, setRunSizes] = useState<Record<string, number>>({});

  useEffect(() => {
    if (frames.length && selected > frames.length - 1) onSelect(frames.length - 1);
  }, [frames.length, selected, onSelect]);

  const sel = Math.max(0, Math.min(selected, frames.length - 1));
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
    <aside className="edit-panel">
      <div className="ep-frames">
        {frames.map((f) => (
          <button
            type="button"
            key={f.index}
            className={`ep-frame${f.index === sel ? ' active' : ''}`}
            onClick={() => onSelect(f.index)}
          >
            <span className="ep-num">{f.index + 1}</span>
            <span className="ep-title">{f.title || <em>untitled</em>}</span>
          </button>
        ))}
      </div>

      {frame && (
        <div className="ep-controls">
          <label className="ep-field">
            <span>Title</span>
            <input
              key={`title-${frame.index}-${frame.title}`}
              defaultValue={frame.title}
              onBlur={(e) => commitTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </label>

          {frame.texts.map((t, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: text runs can repeat; index keeps fields stable across re-renders
            <div className="ep-field" key={`text-${frame.index}-${i}-${t}`}>
              <span>Text</span>
              <input
                defaultValue={t}
                onBlur={(e) => commitText(t, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
              <div className="ep-run-tools">
                <button
                  type="button"
                  title="bold"
                  onClick={() => edit({ kind: 'runBold', frameIndex: frame.index, runText: t })}
                >
                  B
                </button>
                <button type="button" onClick={() => stepRun(t, -1)}>
                  A−
                </button>
                <button type="button" onClick={() => stepRun(t, 1)}>
                  A+
                </button>
                {COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className="ep-swatch ep-swatch-sm"
                    style={{ background: c }}
                    title={c}
                    onClick={() =>
                      edit({ kind: 'runColor', frameIndex: frame.index, runText: t, color: c })
                    }
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="ep-row">
            <span>Font size</span>
            <button type="button" onClick={() => stepSize(-1)}>
              A−
            </button>
            <button type="button" onClick={() => stepSize(1)}>
              A+
            </button>
          </div>

          <div className="ep-row">
            <span>Color</span>
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className="ep-swatch"
                style={{ background: c }}
                title={c}
                onClick={() => edit({ kind: 'color', frameIndex: frame.index, color: c })}
              />
            ))}
          </div>

          <div className="ep-row">
            <span>Frame</span>
            <button
              type="button"
              disabled={sel <= 0}
              onClick={() => edit({ kind: 'reorder', from: sel, to: sel - 1 })}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={sel >= frames.length - 1}
              onClick={() => edit({ kind: 'reorder', from: sel, to: sel + 1 })}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => edit({ kind: 'duplicate', frameIndex: frame.index })}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="ep-danger"
              onClick={() => edit({ kind: 'delete', frameIndex: frame.index })}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
