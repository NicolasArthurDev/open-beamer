import type * as Ast from '@unified-latex/unified-latex-types';
import { getParser } from '@unified-latex/unified-latex-util-parse';
import { replaceNode } from '@unified-latex/unified-latex-util-replace';
import { toString as latexToString } from '@unified-latex/unified-latex-util-to-string';
import { visit } from '@unified-latex/unified-latex-util-visit';

// unified-latex only attaches arguments to macros it knows the signature of. Beamer's
// content macros aren't in the default table, so we register the ones we edit. `m` = one
// mandatory argument.
const parser = getParser({
  macros: {
    frametitle: { signature: 'm' },
    title: { signature: 'm' },
    frame: { signature: 'm' },
  },
});

export function parseTex(src: string): Ast.Root {
  return parser.parse(src);
}

export function printTex(ast: Ast.Root): string {
  return latexToString(ast);
}

function textArgument(text: string): Ast.Argument {
  return {
    type: 'argument',
    openMark: '{',
    closeMark: '}',
    content: [{ type: 'string', content: text }],
  };
}

/**
 * Replace the title of a frame whose current `\frametitle` text matches `oldTitle`.
 * Returns whether anything changed.
 */
export function setFrameTitle(ast: Ast.Root, oldTitle: string, newTitle: string): boolean {
  let changed = false;
  visit(ast, (node) => {
    if (node.type !== 'macro' || node.content !== 'frametitle' || !node.args?.length) {
      return;
    }
    const arg = node.args[node.args.length - 1];
    if (latexToString(arg.content).trim() === oldTitle) {
      arg.content = parser.parse(newTitle).content;
      changed = true;
    }
  });
  return changed;
}

/**
 * Wrap a standalone word in `\textcolor{color}{word}`. Returns whether anything changed.
 */
export function wrapInColor(ast: Ast.Root, word: string, color: string): boolean {
  let changed = false;
  replaceNode(ast, (node) => {
    if (node.type === 'string' && node.content === word) {
      changed = true;
      return {
        type: 'macro',
        content: 'textcolor',
        args: [textArgument(color), textArgument(word)],
      } as Ast.Macro;
    }
    return undefined;
  });
  return changed;
}
