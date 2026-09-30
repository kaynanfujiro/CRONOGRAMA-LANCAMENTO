/** Datas como "dia UTC em milissegundos" (sem problema de fuso). Usado pelo web e pelo servidor. */
export const DIA = 864e5;

/** Hoje (dia UTC) no fuso de Brasília. */
export function hojeUTC(): number {
  const s = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  return deISO(s);
}

export function deISO(s: string): number {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export const dias = (a: number, b: number) => Math.round((b - a) / DIA);
