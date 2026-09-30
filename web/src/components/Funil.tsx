import type { Modelo } from '@shared/types';
import type { ProjetoCalc } from '../lib/calc';

/** Quantos projetos ativos estão em cada fase — mostra onde está o gargalo. */
export function Funil({ linhas, modelo, aoClicar }: { linhas: ProjetoCalc[]; modelo: Modelo; aoClicar: (fase: string) => void }) {
  const ativos = linhas.filter((r) => !r.cancelado && !r.concluido);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-bold uppercase tracking-wide">Onde estão os projetos ativos</h2>
      <div className="overflow-x-auto">
        <div className="grid min-w-[900px] gap-[3px]" style={{ gridTemplateColumns: `repeat(${modelo.fases.length}, minmax(0,1fr))` }}>
          {modelo.fases.map((f, i) => {
            const n = ativos.filter((r) => r.atuais.includes(i)).length;
            return (
              <button
                key={f.nome}
                type="button"
                onClick={() => aoClicar(f.nome)}
                className="flex min-w-0 flex-col gap-1 text-left"
                title={`${f.nome}: ${n} — clique para filtrar`}
              >
                <span
                  className="flex h-[30px] items-center justify-center rounded-[3px] font-display text-[17px]"
                  style={n ? { background: f.cor, color: '#fff', textShadow: '0 1px 1px rgba(0,0,0,.35)' } : { background: 'var(--sunk)', color: 'var(--muted)' }}
                >
                  {n}
                </span>
                <small className="text-[11px] leading-tight text-muted">{f.nome}</small>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
