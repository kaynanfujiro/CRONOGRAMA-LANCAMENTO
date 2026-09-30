/**
 * Farol automático: transforma o cálculo do cronograma em
 * "Atrasado" / "Atenção" / "No Prazo" — o mesmo texto das opções do campo
 * "Status do Projeto" no ClickUp.
 */
import type { RegrasFarol } from './types';
import type { ProjetoCalc } from './calc';
import { dias } from './datas';

export type FarolAuto = 'Atrasado' | 'Atenção' | 'No Prazo';

export interface ResultadoFarol {
  farol: FarolAuto;
  /** Explicação curta (vai para a tela e para o log). */
  motivo: string;
}

/** Resultado de uma rodada do farol automático (servidor → tela). */
export interface Mudanca {
  id: string;
  nome: string;
  de: string | null;
  para: FarolAuto;
  motivo: string;
  erro?: string;
}
export interface RelatorioFarol {
  em: string;
  ativo: boolean;
  /** true = prévia (nada foi gravado no ClickUp) */
  simulado: boolean;
  avaliados: number;
  alterados: number;
  semMudanca: number;
  ignorados: number;
  mudancas: Mudanca[];
  aviso?: string;
}

/** null = não se aplica (backlog, concluído ou cancelado): o campo não é mexido. */
export function calcularFarol(r: ProjetoCalc, regras: RegrasFarol, hoje: number): ResultadoFarol | null {
  if (r.cancelado || r.concluido || r.semInfo || r.desvio == null) return null;

  // fase atual (a primeira em andamento)
  const f = r.atuais.map((i) => r.fases[i]).find((x) => x.estado === 'atual');
  let usados: number | null = null;
  let pct: number | null = null;
  if (f && f.prazo > 0) {
    if (f.rs != null) usados = dias(f.rs, hoje);
    else if (f.pe > f.ps) usados = dias(f.ps, hoje); // início anterior ao ClickUp: usa a janela planejada
    if (usados != null) pct = Math.round((usados / f.prazo) * 100);
  }

  // 1) Atrasado — o real já está diferente do esperado
  if (r.desvio > regras.toleranciaDias)
    return { farol: 'Atrasado', motivo: `conclusão projetada ${r.desvio} d depois do planejado` };
  if (f && f.rs != null && usados != null && usados > f.prazo)
    return { farol: 'Atrasado', motivo: `${f.nome}: ${usados} d de ${f.prazo} d (estourou o prazo da fase)` };

  // 2) Atenção — risco eminente: a fase atual já consumiu boa parte do prazo
  if (f && pct != null && pct >= regras.atencaoPct)
    return { farol: 'Atenção', motivo: `${f.nome}: ${usados} d de ${f.prazo} d (${pct}% do prazo)` };
  if (r.desvio > 0) return { farol: 'Atenção', motivo: `conclusão projetada +${r.desvio} d (dentro da tolerância)` };

  // 3) No prazo
  return {
    farol: 'No Prazo',
    motivo: f && pct != null ? `${f.nome}: ${usados} d de ${f.prazo} d (${pct}% do prazo)` : 'dentro do planejado',
  };
}
