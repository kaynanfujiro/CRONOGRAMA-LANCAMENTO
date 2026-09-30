import type { Farol } from '@shared/types';
import type { Saude } from './calc';

/** Ordem de exibição e chave de filtro. */
export const FAROIS = ['Atrasado', 'Atenção', 'No Prazo', 'Sem farol'] as const;
export type NomeFarol = (typeof FAROIS)[number];

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Converte o farol do ClickUp para as cores da tela (verde/amarelo/vermelho legíveis). */
export function tomFarol(f: Farol | null): Saude {
  if (!f) return 'neutral';
  const n = norm(f.nome);
  if (n.includes('atras')) return 'bad';
  if (n.includes('aten')) return 'warn';
  if (n.includes('prazo') || n.includes('ok')) return 'ok';
  return 'neutral';
}

export function nomeFarol(f: Farol | null): NomeFarol {
  const t = tomFarol(f);
  return t === 'bad' ? 'Atrasado' : t === 'warn' ? 'Atenção' : t === 'ok' ? 'No Prazo' : 'Sem farol';
}

/** Classe da faixa colorida à esquerda da linha. */
export const faixaFarol: Record<Saude, string> = {
  ok: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  neutral: 'bg-line',
};

/**
 * O farol é decidido na reunião; o desvio é calculado.
 * Quando os dois discordam muito, vale conversar no follow-up.
 */
export function divergencia(f: Farol | null, desvio: number | null): string | null {
  if (!f || desvio == null) return null;
  const t = tomFarol(f);
  if (t === 'ok' && desvio > 15) return `Farol "No Prazo", mas o cálculo projeta +${desvio} dias na conclusão.`;
  if (t === 'bad' && desvio <= 0) return 'Farol "Atrasado", mas o cálculo indica que o projeto está dentro do plano.';
  return null;
}
