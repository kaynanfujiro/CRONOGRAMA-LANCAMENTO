import type { Modelo, TipoProjeto, RegrasFarol } from './types';

/**
 * Modelo padrão: 13 fases e 3 tipos de projeto, cada um com seu lead time.
 * Os blocos com mais de uma fase são as células mescladas da planilha
 * (fases que correm juntas no mesmo período).
 *
 * Índices das fases:
 *  0 Escopo · 1 Sourcing · 2 Aguardando amostra · 3 Teste · 4 Cadastro · 5 Arte
 *  6 First order · 7 Em trânsito amostra · 8 Marketing · 9 Envio 1º lote
 * 10 Lançamento · 11 Chegada 1º lote · 12 Ciclo de vida
 */
const b = (fases: number[], dias: number) => ({ fases, dias });

export const MODELO_PADRAO: Modelo = {
  versao: 2,
  fases: [
    { nome: 'Escopo / Briefing', cor: '#B993EE', status: ['escopo / briefing'] },
    { nome: 'Sourcing', cor: '#E39A7E', status: ['sourcing'] },
    { nome: 'Aguardando amostra', cor: '#9A5BB8', status: ['aguardando amostra'] },
    { nome: 'Teste / Validação', cor: '#D9DB5E', status: ['teste / validação'] },
    { nome: 'Cadastro SKU / NCM', cor: '#2E6B45', status: ['cadastro sku / ncm'] },
    { nome: 'Desenvolvimento arte', cor: '#6FA3B5', status: ['desenvolvimento arte'] },
    { nome: 'First order', cor: '#8A1E91', status: ['first order'] },
    { nome: 'Em trânsito amostra c/ arte', cor: '#D84B85', status: ['envio amostra c/ arte', 'em trânsito amostra c/ arte'] },
    { nome: 'Marketing', cor: '#9E837A', status: ['marketing'] },
    { nome: 'Envio primeiro lote', cor: '#C3102F', status: ['envio primeiro lote'] },
    { nome: 'Lançamento', cor: '#23906A', status: ['lançamento'] },
    { nome: 'Chegada primeiro lote', cor: '#50545C', status: ['chegada primeiro lote'] },
    { nome: 'Ciclo de vida', cor: '#4A86E8', status: ['ciclo de vida', 'complete', 'concluído'] },
  ],
  tipos: [
    {
      id: 'portfolio',
      nome: 'Ampliação de Portfólio',
      referencia: '6 a 8 meses',
      meta: 240,
      blocos: [b([0], 15), b([1], 50), b([2], 20), b([3], 20), b([4], 5), b([5], 5), b([6, 7], 60), b([8, 9], 60), b([10, 11], 5), b([12], 0)],
    },
    {
      id: 'familia',
      nome: 'Ampliação de Família',
      referencia: '12 meses',
      meta: 365,
      blocos: [b([0], 15), b([1], 90), b([2], 20), b([3], 20), b([4], 7), b([5], 10), b([6, 7], 60), b([8, 9], 60), b([10], 10), b([11], 10), b([12], 5)],
    },
    {
      id: 'nova',
      nome: 'Nova Família',
      referencia: '12 a 24 meses',
      meta: 730,
      blocos: [b([0], 30), b([1], 120), b([2], 20), b([3], 25), b([4], 7), b([5], 15), b([6, 7], 60), b([8, 9], 60), b([10, 11], 20), b([12], 10)],
    },
  ],
  tipoPadrao: 'familia',
  farolAuto: { ativo: false, toleranciaDias: 0, atencaoPct: 80 },
};

export const REGRAS_FAROL_PADRAO: RegrasFarol = { ativo: false, toleranciaDias: 0, atencaoPct: 80 };
export const regrasFarol = (m: Modelo): RegrasFarol => ({ ...REGRAS_FAROL_PADRAO, ...(m.farolAuto ?? {}) });

/** Status do ClickUp que não são fases. */
export const STATUS_BACKLOG = ['backlog', 'to do'];
export const STATUS_CANCELADO = ['cancelado', 'cancelled'];

/** Normaliza textos para comparar ("Teste / Validação" → "teste validacao"). */
export const normalizar = (s: string | null | undefined): string =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Retorna o índice da fase, -1 para backlog, 'x' para cancelado, ou null se desconhecido. */
export function faseDoStatus(modelo: Modelo, status: string): number | -1 | 'x' | null {
  const k = normalizar(status);
  if (STATUS_BACKLOG.map(normalizar).includes(k)) return -1;
  if (STATUS_CANCELADO.map(normalizar).includes(k)) return 'x';
  const i = modelo.fases.findIndex(
    (f) => normalizar(f.nome) === k || f.status.some((s) => normalizar(s) === k),
  );
  return i >= 0 ? i : null;
}

/**
 * Encontra o tipo do projeto pelo valor do campo no ClickUp.
 * Tolera variações de escrita ("Portifólio", "Portfolio", "AMPLIAÇÃO DE FAMÍLIA").
 */
export function tipoDoProjeto(modelo: Modelo, valor: string | null): TipoProjeto {
  const padrao = modelo.tipos.find((t) => t.id === modelo.tipoPadrao) ?? modelo.tipos[0];
  if (!valor) return padrao;
  const k = normalizar(valor).replace('portifolio', 'portfolio');
  const exato = modelo.tipos.find((t) => normalizar(t.nome).replace('portifolio', 'portfolio') === k);
  if (exato) return exato;
  if (k.includes('portf')) return modelo.tipos.find((t) => t.id === 'portfolio') ?? padrao;
  if (k.includes('nova')) return modelo.tipos.find((t) => t.id === 'nova') ?? padrao;
  if (k.includes('famil')) return modelo.tipos.find((t) => t.id === 'familia') ?? padrao;
  return padrao;
}

/** Lead time total de um tipo (soma dos blocos). */
export const leadTimeTipo = (t: TipoProjeto) => t.blocos.reduce((s, b) => s + b.dias, 0);
