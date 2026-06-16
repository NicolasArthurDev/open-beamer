import {
  Columns2,
  Hash,
  Image as ImageIcon,
  List,
  ListOrdered,
  type LucideIcon,
  Move,
  Plus,
  Quote,
  SquareStack,
} from 'lucide-react';

export type ComponentDef = {
  id: string;
  label: string;
  icon: LucideIcon;
  category: string;
  /**
   * 'frame' inserts into the active frame's body; 'deck' adds a frame after the active one;
   * 'deck-start' adds a frame at the very beginning of the deck; 'nibox' inserts a NiTeX
   * positioned box (draggable) using `snippet` as its initial content.
   */
  target: 'frame' | 'deck' | 'deck-start' | 'nibox';
  snippet: string;
};

// Curated, portable LaTeX (beamer + core only — no extra packages, no [fragile]).
export const COMPONENTS: ComponentDef[] = [
  {
    id: 'new-slide',
    label: 'Novo slide',
    icon: Plus,
    category: 'Slide',
    target: 'deck',
    snippet: '\\begin{frame}{Novo slide}\n  \n\\end{frame}',
  },
  {
    id: 'new-slide-start',
    label: 'Slide no início',
    icon: Plus,
    category: 'Slide',
    target: 'deck-start',
    snippet: '\\begin{frame}{Novo slide}\n  \n\\end{frame}',
  },
  {
    id: 'bullets',
    label: 'Bullets',
    icon: List,
    category: 'Texto',
    target: 'frame',
    snippet:
      '\\begin{itemize}\n  \\item Primeiro item\n  \\item Segundo item\n  \\item Terceiro item\n\\end{itemize}',
  },
  {
    id: 'numbered',
    label: 'Lista numerada',
    icon: ListOrdered,
    category: 'Texto',
    target: 'frame',
    snippet:
      '\\begin{enumerate}\n  \\item Primeiro\n  \\item Segundo\n  \\item Terceiro\n\\end{enumerate}',
  },
  {
    id: 'two-cols',
    label: 'Duas colunas',
    icon: Columns2,
    category: 'Layout',
    target: 'frame',
    snippet:
      '\\begin{columns}[T,onlytextwidth]\n  \\column{0.5\\textwidth}\n  Coluna esquerda\n  \\column{0.5\\textwidth}\n  Coluna direita\n\\end{columns}',
  },
  {
    id: 'block',
    label: 'Bloco',
    icon: SquareStack,
    category: 'Layout',
    target: 'frame',
    snippet: '\\begin{block}{Título}\n  Conteúdo do bloco.\n\\end{block}',
  },
  {
    id: 'free-box',
    label: 'Caixa livre',
    icon: Move,
    category: 'Layout',
    target: 'nibox',
    // For target 'nibox' the snippet is the NiTeX component type to insert.
    snippet: 'box',
  },
  {
    id: 'big-number',
    label: 'Número grande',
    icon: Hash,
    category: 'Destaque',
    target: 'frame',
    snippet: '\\begin{center}\n  {\\Huge\\textbf{42}}\\\\[2mm]\n  rótulo\n\\end{center}',
  },
  {
    id: 'quote',
    label: 'Citação',
    icon: Quote,
    category: 'Destaque',
    target: 'frame',
    snippet: '\\begin{quote}\n  Texto da citação.\n\\end{quote}',
  },
  {
    id: 'image',
    label: 'Imagem',
    icon: ImageIcon,
    category: 'Mídia',
    target: 'frame',
    snippet:
      '\\begin{center}\n  \\fbox{\\parbox[c][3cm][c]{6cm}{\\centering Imagem}}\n\\end{center}',
  },
];
