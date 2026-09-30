/** Datas como "dia UTC em milissegundos" para cálculos sem problema de fuso. */
import { DIA } from '@shared/datas';
export { DIA, deISO, dias } from '@shared/datas';
export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function hoje(): number {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
}


export function fmt(t: number | null | undefined): string {
  if (t == null) return '—';
  const x = new Date(t);
  const dd = String(x.getUTCDate()).padStart(2, '0');
  const mm = String(x.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${String(x.getUTCFullYear()).slice(2)}`;
}


/** Semana ISO (1–53), igual à numeração da planilha. */
export function semanaISO(t: number): number {
  const x = new Date(t);
  const dia = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dia + 3);
  const primeiraQuinta = Date.UTC(x.getUTCFullYear(), 0, 4);
  return 1 + Math.round(((x.getTime() - primeiraQuinta) / DIA - 3 + ((new Date(primeiraQuinta).getUTCDay() + 6) % 7)) / 7);
}

/** Segunda-feira da semana de t. */
export const segunda = (t: number) => t - ((new Date(t).getUTCDay() + 6) % 7) * DIA;
