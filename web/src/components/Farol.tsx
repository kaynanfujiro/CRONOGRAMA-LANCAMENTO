import type { Farol as TFarol } from '@shared/types';
import type { ProjetoCalc } from '../lib/calc';
import { FAROIS, nomeFarol, tomFarol, type NomeFarol } from '../lib/farol';

const ESTILO = {
  ok: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  neutral: 'bg-sunk text-muted',
} as const;
const PONTO = { ok: 'bg-good', warn: 'bg-warn', bad: 'bg-bad', neutral: 'bg-muted' } as const;

/** Selo do farol: ● Atrasado */
export function FarolBadge({ farol, grande }: { farol: TFarol | null; grande?: boolean }) {
  const t = tomFarol(farol);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${ESTILO[t]} ${grande ? 'px-3 py-1 text-[13px]' : 'px-2 py-px text-[11px]'}`}
      title="Farol do follow-up (campo Status do Projeto no ClickUp)"
    >
      <i className={`inline-block rounded-full ${PONTO[t]} ${grande ? 'h-2.5 w-2.5' : 'h-2 w-2'}`} />
      {farol ? farol.nome : 'Sem farol'}
    </span>
  );
}

/** Resumo do farol de todos os projetos ativos — clique para filtrar. */
export function PainelFarol({
  linhas,
  ativo,
  aoClicar,
  semTitulo,
}: {
  linhas: ProjetoCalc[];
  ativo: string;
  aoClicar: (f: NomeFarol | '') => void;
  /** esconde o título (quando o painel já está dentro de um cartão) */
  semTitulo?: boolean;
}) {
  const ativos = linhas.filter((r) => !r.cancelado && !r.concluido);
  const cont = (n: NomeFarol) => ativos.filter((r) => nomeFarol(r.p.farol) === n).length;
  const tom = { Atrasado: 'bad', Atenção: 'warn', 'No Prazo': 'ok', 'Sem farol': 'neutral' } as const;
  const total = ativos.length || 1;

  return (
    <section className="flex flex-col gap-2" aria-label="Farol dos projetos">
      {!semTitulo && <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">Farol do follow-up</h2>
        <span className="text-xs text-muted">Campo “Status do Projeto” no ClickUp · clique para filtrar</span>
      </div>}
      {/* barra proporcional */}
      <div className="flex h-2.5 overflow-hidden rounded-full bg-sunk">
        {FAROIS.map((n) => (
          <div key={n} className={PONTO[tom[n]]} style={{ width: `${(cont(n) / total) * 100}%` }} title={`${n}: ${cont(n)}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FAROIS.map((n) => {
          const t = tom[n];
          const sel = ativo === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={sel}
              onClick={() => aoClicar(sel ? '' : n)}
              className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition ${
                sel ? 'border-accent bg-accent-soft shadow-sm' : 'border-line bg-surface hover:border-accent'
              }`}
            >
              <i className={`h-3.5 w-3.5 flex-none rounded-full ${PONTO[t]}`} />
              <span className="flex flex-col">
                <b className="font-display text-2xl leading-none tabular-nums">{cont(n)}</b>
                <span className="text-xs text-muted">{n}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
