import type { ProjetoCalc } from '../lib/calc';
import { DIA } from '../lib/datas';

export function Kpis({ linhas, hoje }: { linhas: ProjetoCalc[]; hoje: number }) {
  const ativos = linhas.filter((r) => !r.cancelado && !r.concluido);
  const comFase = ativos.filter((r) => r.desvio != null);
  const media = comFase.length ? Math.round(comFase.reduce((s, r) => s + r.desvio!, 0) / comFase.length) : 0;
  const atrasados = comFase.filter((r) => r.desvio! > 15).length;
  const proximos = linhas.filter(
    (r) => !r.cancelado && r.lancProj != null && r.lancProj >= hoje && r.lancProj <= hoje + 90 * DIA,
  ).length;
  const backlog = ativos.length - comFase.length;

  const cards = [
    { v: String(ativos.length), t: `projetos em andamento${backlog ? ` · ${backlog} em backlog` : ''}` },
    { v: `${media > 0 ? '+' : ''}${media} d`, t: 'desvio médio na conclusão', alerta: media > 15 },
    { v: String(atrasados), t: 'atrasados (+15 dias)', alerta: atrasados > 0 },
    { v: String(proximos), t: 'lançamentos nos próximos 90 dias' },
  ];
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Indicadores">
      {cards.map((c) => (
        <div
          key={c.t}
          className={`flex flex-col gap-0.5 rounded-lg border border-l-4 px-4 py-3 ${c.alerta ? 'border-bad/40 border-l-bad bg-bad-soft' : 'border-line border-l-accent bg-surface'}`}
        >
          <b className={`font-display text-[32px] leading-none tabular-nums ${c.alerta ? 'text-bad' : 'text-accent'}`}>{c.v}</b>
          <span className="text-xs text-muted">{c.t}</span>
        </div>
      ))}
    </section>
  );
}
