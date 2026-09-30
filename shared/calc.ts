/**
 * O coração do cronograma: planejado × real × projeção de cada projeto.
 *
 * - Planejado: data de início do card + prazos do TIPO do projeto (por bloco).
 *   Fases do mesmo bloco (células mescladas) ocupam o mesmo período.
 * - Real: datas das mudanças de status no ClickUp.
 * - Projeção: a fase atual termina no fim previsto ou hoje (o que for mais tarde);
 *   as fases seguintes vêm em sequência com os prazos do modelo.
 * - Desvio: conclusão projetada − conclusão planejada (dias).
 * - Fases dispensadas (campo "FASES DISPENSADAS"): não entram no planejado nem no real.
 *   Se todas as fases de um bloco forem dispensadas, o bloco some e o lead time encolhe;
 *   se só parte do bloco (fases paralelas), o prazo do bloco continua pelas outras.
 */
import type { Modelo, Projeto, TipoProjeto } from './types';
import { tipoDoProjeto } from './modelo-padrao';
import { DIA, deISO, dias } from './datas';

export type Estado = 'feito' | 'atual' | 'futuro' | 'dispensada';
export type Saude = 'ok' | 'warn' | 'bad' | 'neutral';

export interface FaseCalc {
  i: number;
  nome: string;
  cor: string;
  prazo: number;
  /** posição na raia quando há fases paralelas */
  slot: number;
  nslot: number;
  /** planejado */
  ps: number;
  pe: number;
  /** real (null = sem data registrada) */
  rs: number | null;
  re: number | null;
  /** fim previsto da fase em curso */
  fimPrevisto: number | null;
  /** projeção das fases futuras */
  xs: number | null;
  xe: number | null;
  estado: Estado;
  /** o card pulou esta fase no ClickUp sem ela estar marcada como dispensada */
  pulada: boolean;
}

export interface ProjetoCalc {
  p: Projeto;
  /** Tipo usado no cálculo (o do card ou o padrão). */
  tipo: TipoProjeto;
  /** true quando o card não tem "Tipo de Projeto" e o padrão foi usado. */
  tipoAssumido: boolean;
  /** Lead time deste projeto (tipo − blocos dispensados), em dias. */
  leadTime: number;
  /** Índices das fases dispensadas. */
  dispensadas: number[];
  fases: FaseCalc[];
  inicioPlan: number;
  fimPlan: number;
  concluido: boolean;
  cancelado: boolean;
  semInfo: boolean;
  fimProj: number | null;
  desvio: number | null;
  lancPlan: number;
  lancProj: number | null;
  saude: Saude;
  saudeTxt: string;
  atuais: number[];
  esperadas: number[];
}

export function calcular(p: Projeto, m: Modelo, hoje: number): ProjetoCalc {
  const tipo = tipoDoProjeto(m, p.tipo);
  const R = p.real ?? {};
  // a fase em curso nunca é tratada como dispensada (evita sumir com o projeto do gráfico)
  const disp = new Set((p.dispensadas ?? []).filter((i) => !R[i]?.emCurso));
  const vale = (i: number) => !disp.has(i);
  let ultima = m.fases.length - 1;
  while (ultima > 0 && disp.has(ultima)) ultima--;
  // blocos só com as fases que se aplicam (bloco vazio = removido)
  const blocos = tipo.blocos.map((b) => ({ ...b, fases: b.fases.filter(vale) })).filter((b) => b.fases.length);
  const iLanc = Math.max(0, m.fases.findIndex((f) => f.nome.toLowerCase().startsWith('lançamento')));
  const cancelado = p.situacao === 'Cancelado';
  const semInfo = Object.keys(R).length === 0;

  // prazo de cada fase = prazo do bloco em que ela está
  const blocoDe: number[] = [];
  tipo.blocos.forEach((bl, k) => bl.fases.forEach((i) => (blocoDe[i] = k)));
  const dur = m.fases.map((_, i) => (disp.has(i) ? 0 : tipo.blocos[blocoDe[i]]?.dias ?? 0));
  const puladas = new Set(p.puladas ?? []);

  const fases: FaseCalc[] = m.fases.map((f, i) => ({
    i, nome: f.nome, cor: f.cor, prazo: dur[i], slot: 0, nslot: 1,
    ps: 0, pe: 0, rs: null, re: null, fimPrevisto: null, xs: null, xe: null,
    estado: disp.has(i) ? 'dispensada' : 'futuro', pulada: puladas.has(i),
  }));

  // ---------- planejado: blocos em sequência; fases do bloco no mesmo período ----------
  let t = deISO(p.inicioPlan);
  for (const bl of tipo.blocos) {
    // dispensadas ficam com período zero no ponto onde estariam
    bl.fases.filter((i) => disp.has(i)).forEach((i) => Object.assign(fases[i], { ps: t, pe: t }));
    const ativas = bl.fases.filter(vale);
    ativas.forEach((i, k) => Object.assign(fases[i], { ps: t, pe: t + bl.dias * DIA, slot: k, nslot: ativas.length }));
    if (ativas.length) t += bl.dias * DIA;
  }
  const fimPlan = t;

  // ---------- real + projeção ----------
  let a = R[0]?.ini ? deISO(R[0].ini) : deISO(p.inicioPlan);
  for (const bl of blocos) {
    let fimBloco = a;
    for (const i of bl.fases) {
      const f = fases[i];
      const r = R[i] ?? {};
      const inicioPossivel = a;
      let e: number;
      if (r.fim || r.feito) {
        f.estado = 'feito';
        f.rs = r.ini ? deISO(r.ini) : null;
        f.re = r.fim ? deISO(r.fim) : null;
        e = f.re ?? f.pe;
      } else if (r.ini || r.emCurso) {
        f.estado = 'atual';
        f.rs = r.ini ? deISO(r.ini) : null;
        const base = f.rs != null ? f.rs + dur[i] * DIA : f.pe; // sem início registrado: usa o fim planejado
        f.fimPrevisto = cancelado ? base : Math.max(base, hoje);
        e = f.fimPrevisto;
      } else {
        f.estado = 'futuro';
        if (!cancelado && !semInfo) {
          f.xs = Math.max(inicioPossivel, hoje);
          f.xe = f.xs + dur[i] * DIA;
          e = f.xe;
        } else e = f.pe;
      }
      fimBloco = Math.max(fimBloco, e);
    }
    a = fimBloco;
  }

  const concluido = p.situacao === 'Concluído';
  const fimProj = cancelado || semInfo ? null : concluido ? (fases[ultima].re ?? fases[ultima].rs ?? a) : a;
  const desvio = fimProj == null ? null : dias(fimPlan, fimProj);

  let atuais = fases.filter((f) => f.estado === 'atual').map((f) => f.i);
  if (!atuais.length && !concluido && !semInfo) {
    const prox = fases.find((f) => f.estado === 'futuro');
    if (prox) atuais = [prox.i];
  }
  if (concluido) atuais = [ultima];
  const esperadas = fases.filter((f) => f.ps <= hoje && f.pe > hoje).map((f) => f.i);

  let saude: Saude;
  let saudeTxt: string;
  if (cancelado) [saude, saudeTxt] = ['neutral', 'Cancelado'];
  else if (semInfo) [saude, saudeTxt] = ['neutral', 'Backlog'];
  else if (concluido) [saude, saudeTxt] = [desvio! > 0 ? 'warn' : 'ok', 'Lançado' + (desvio! > 0 ? ` +${desvio} d` : '')];
  else if (desvio! <= 0) [saude, saudeTxt] = ['ok', desvio! < 0 ? `${desvio} d (adiantado)` : 'No prazo'];
  else if (desvio! <= 15) [saude, saudeTxt] = ['warn', `+${desvio} d`];
  else [saude, saudeTxt] = ['bad', `+${desvio} d`];

  return {
    p, tipo, tipoAssumido: !p.tipo, fases, inicioPlan: deISO(p.inicioPlan), fimPlan, concluido, cancelado, semInfo, fimProj, desvio,
    leadTime: blocos.reduce((s, b) => s + b.dias, 0), dispensadas: [...disp].sort((x, y) => x - y),
    lancPlan: fases[iLanc].ps, lancProj: fases[iLanc].rs ?? fases[iLanc].xs ?? null,
    saude, saudeTxt, atuais, esperadas,
  };
}

/** Cor da pílula de desvio de uma fase. */
export const saudeDesvio = (d: number): Saude => (d <= 0 ? 'ok' : d <= 7 ? 'warn' : 'bad');
