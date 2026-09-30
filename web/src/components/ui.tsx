import type { ReactNode } from 'react';
import type { Saude } from '../lib/calc';

const CORES: Record<Saude, string> = {
  ok: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  neutral: 'bg-sunk text-muted',
};

export function Pill({ saude, children }: { saude: Saude; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-px text-[11px] font-semibold tabular-nums ${CORES[saude]}`}>
      {children}
    </span>
  );
}

export function Chip({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: cor }} />
      {children}
    </span>
  );
}

export function Botao({
  children,
  onClick,
  primario,
  disabled,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  primario?: boolean;
  disabled?: boolean;
  href?: string;
}) {
  const cls = `inline-flex items-center rounded-md border px-3 py-1.5 font-medium transition focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-progress disabled:opacity-50 ${
    primario ? 'border-accent bg-accent text-white hover:opacity-90' : 'border-line bg-surface text-ink hover:border-accent hover:text-accent'
  }`;
  if (href)
    return (
      <a className={cls} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export const Rotulo = ({ children }: { children: ReactNode }) => (
  <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</span>
);
