import {
  Columns2,
  Hash,
  Image as ImageIcon,
  List,
  ListOrdered,
  type LucideIcon,
  Plus,
  Quote,
  SquareStack,
} from 'lucide-react';

export type ComponentDef = {
  id: string;
  label: string;
  icon: LucideIcon;
  category: string;
  /** 'deck' inserts a whole new frame; 'frame' inserts into the selected frame's body. */
  target: 'frame' | 'deck';
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
