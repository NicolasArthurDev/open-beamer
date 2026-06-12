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

export function EditPanel({ deckId }: { deckId: string }) {
  const { frames } = useOutline(deckId);
  const edit = useEdit(deckId);
  const [sel, setSel] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(4); // normalsize

  useEffect(() => {
    if (sel > frames.length - 1) setSel(Math.max(0, frames.length - 1));
  }, [frames.length, sel]);

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

  return (
    <aside className="edit-panel">
      <div className="ep-frames">
        {frames.map((f) => (
          <button
            type="button"
            key={f.index}
            className={`ep-frame${f.index === sel ? ' active' : ''}`}
            onClick={() => setSel(f.index)}
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
            // biome-ignore lint/suspicious/noArrayIndexKey: text runs can repeat; index keeps inputs stable across re-renders
            <label className="ep-field" key={`text-${frame.index}-${i}-${t}`}>
              <span>Text</span>
              <input
                defaultValue={t}
                onBlur={(e) => commitText(t, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            </label>
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
