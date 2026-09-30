/**
 * Dashboards: situação da carteira de projetos.
 * Todos os gráficos respeitam os filtros do topo.
 */
import type { Modelo } from '@shared/types';
import type { ProjetoCalc } from '../lib/calc';
import { nomeFarol, type NomeFarol } from '../lib/farol';
import { Kpis } from '../components/Kpis';
import { PainelFarol } from '../components/Farol';

/* cores do farol: status reservados (verde/amarelo/vermelho) + cinza para "sem farol" */
const COR_FAROL: Record<NomeFarol, string> = {
  Atrasado: 'var(--bad)',
  Atenção: 'var(--warn)',
  'No Prazo': 'var(--good)',
  'Sem farol': '#b9bec2',
};
const ORDEM_FAROL: NomeFarol[] = ['Atrasado', 'Atenção', 'No Prazo', 'Sem farol'];

interface Grupo {
  rotulo: string;
  sub?: string;
  seg: { nome: string; valor: number; cor: string }[];
}

function Cartao({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[17px] font-bold uppercase tracking-wide">{titulo}</h3>
        {sub && <span className="text-xs text-muted">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function LegendaFarol() {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted">
      {ORDEM_FAROL.map((n) => (
        <span key={n} className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COR_FAROL[n] }} />
          {n}
        </span>
      ))}
    </div>
  );
}

/** Barras horizontais empilhadas (uma escala para todas as linhas). */
function Barras({ grupos, legenda }: { grupos: Grupo[]; legenda?: React.ReactNode }) {
  const max = Math.max(1, ...grupos.map((g) => g.seg.reduce((s, x) => s + x.valor, 0)));
  const nomesSeg = grupos[0]?.seg.map((s) => s.nome) ?? [];
  return (
    <div className="flex flex-col gap-3">
      {legenda}
      <div className="flex flex-col gap-2">
        {grupos.map((g) => {
          const total = g.seg.reduce((s, x) => s + x.valor, 0);
          const partes = g.seg.filter((s) => s.valor > 0);
          return (
            <div key={g.rotulo} className="grid grid-cols-[minmax(120px,190px)_1fr_36px] items-center gap-3">
              <span className="min-w-0 text-[12.5px] leading-tight">
                <span className="block truncate text-ink" title={g.rotulo}>
                  {g.rotulo}
                </span>
                {g.sub && <span className="block text-[11px] text-muted">{g.sub}</span>}
              </span>
              <div className="relative h-5 rounded bg-sunk">
                <div className="flex h-full gap-[2px]" style={{ width: `${(total / max) * 100}%` }}>
                  {partes.map((s, i) => (
                    <div
                      key={s.nome}
                      className={`h-full transition-opacity hover:opacity-80 ${i === 0 ? 'rounded-l' : ''} ${i === partes.length - 1 ? 'rounded-r' : ''}`}
                      style={{ background: s.cor, flex: s.valor }}
                      title={`${g.rotulo} · ${s.nome}: ${s.valor} projeto${s.valor === 1 ? '' : 's'}`}
                    />
                  ))}
                </div>
              </div>
              <b className="text-right font-mono text-[13px] tabular-nums text-ink">{total}</b>
            </div>
          );
        })}
      </div>
      {/* tabela de apoio (acessibilidade / exportar) */}
      <details className="text-xs text-muted">
        <summary className="cursor-pointer select-none hover:text-accent">Ver tabela</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse tabular-nums">
            <thead>
              <tr>
                <th className="border-b border-line py-1 pr-3 text-left font-semibold"> </th>
                {nomesSeg.map((n) => (
                  <th key={n} className="border-b border-line px-2 py-1 text-right font-semibold">
                    {n}
                  </th>
                ))}
                <th className="border-b border-line px-2 py-1 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.rotulo}>
                  <td className="border-b border-line py-1 pr-3 text-ink">{g.rotulo}</td>
                  {g.seg.map((s) => (
                    <td key={s.nome} className="border-b border-line px-2 py-1 text-right">
                      {s.valor}
                    </td>
                  ))}
                  <td className="border-b border-line px-2 py-1 text-right font-semibold text-ink">{g.seg.reduce((a, s) => a + s.valor, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Agrupa projetos por uma chave e divide cada grupo pelo farol. */
function porFarol(linhas: ProjetoCalc[], chave: (r: ProjetoCalc) => string, ordem?: string[]): Grupo[] {
  const mapa = new Map<string, ProjetoCalc[]>();
  for (const r of linhas) {
    const k = chave(r);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k)!.push(r);
  }
  const chaves = ordem ? ordem.filter((k) => mapa.has(k)) : [...mapa.keys()].sort((a, b) => mapa.get(b)!.length - mapa.get(a)!.length);
  return chaves.map((k) => ({
    rotulo: k,
    seg: ORDEM_FAROL.map((n) => ({ nome: n, valor: mapa.get(k)!.filter((r) => nomeFarol(r.p.farol) === n).length, cor: COR_FAROL[n] })),
  }));
}

export function Dashboards({
  linhas,
  modelo,
  hoje,
  farolAtivo,
  aoFarol,
  aoFase,
}: {
  linhas: ProjetoCalc[];
  modelo: Modelo;
  hoje: number;
  farolAtivo: string;
  aoFarol: (f: NomeFarol | '') => void;
  aoFase: (fase: string) => void;
}) {
  const ativos = linhas.filter((r) => !r.cancelado && !r.concluido);

  // 1) status (fase atual no ClickUp)
  const backlog = ativos.filter((r) => r.semInfo).length;
  const porFase: Grupo[] = modelo.fases.map((f, i) => ({
    rotulo: f.nome,
    seg: [{ nome: 'Projetos', valor: ativos.filter((r) => !r.semInfo && r.atuais.includes(i)).length, cor: f.cor }],
  }));

  // 2) responsável
  const porResp = porFarol(ativos, (r) => r.p.analistas[0] ?? 'Sem responsável');
  // 3) ondas (ordem natural: ONDA 1, 2, 3…)
  const ondas = [...new Set(ativos.map((r) => r.p.onda ?? 'Sem onda'))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const porOnda = porFarol(ativos, (r) => r.p.onda ?? 'Sem onda', ondas);
  // 4) tipo de projeto
  const porTipo = porFarol(ativos, (r) => (r.tipoAssumido ? `${r.tipo.nome} (padrão)` : r.tipo.nome));

  const outros = linhas.length - ativos.length;

  return (
    <div className="flex flex-col gap-5">
      <Kpis linhas={linhas} hoje={hoje} />

      <Cartao titulo="Status dos projetos" sub="Farol do follow-up · campo “Status do Projeto”">
        <PainelFarol linhas={linhas} ativo={farolAtivo} aoClicar={aoFarol} semTitulo />
      </Cartao>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Cartao titulo="Projetos por fase" sub={`${ativos.length - backlog} em andamento · ${backlog} em backlog${outros ? ` · ${outros} concluídos/cancelados` : ''}`}>
          <div className="flex flex-col gap-1.5">
            {porFase.map((g) => {
              const v = g.seg[0].valor;
              const max = Math.max(1, ...porFase.map((x) => x.seg[0].valor));
              return (
                <button
                  key={g.rotulo}
                  type="button"
                  onClick={() => aoFase(g.rotulo)}
                  className="grid grid-cols-[minmax(120px,170px)_1fr_36px] items-center gap-3 rounded text-left hover:bg-sunk"
                  title={`${g.rotulo}: ${v} projeto${v === 1 ? '' : 's'} — clique para ver no cronograma`}
                >
                  <span className="flex items-center gap-1.5 truncate text-[12.5px] text-ink">
                    <i className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: g.seg[0].cor }} />
                    {g.rotulo}
                  </span>
                  <span className="h-4 rounded bg-sunk">
                    {v > 0 && <span className="block h-full rounded" style={{ width: `${(v / max) * 100}%`, background: g.seg[0].cor }} />}
                  </span>
                  <b className="text-right font-mono text-[13px] tabular-nums">{v}</b>
                </button>
              );
            })}
          </div>
        </Cartao>

        <Cartao titulo="Projetos por responsável" sub="dividido pelo farol">
          <Barras grupos={porResp} legenda={<LegendaFarol />} />
        </Cartao>

        <Cartao titulo="Projetos por onda" sub="dividido pelo farol">
          <Barras grupos={porOnda} legenda={<LegendaFarol />} />
        </Cartao>

        <Cartao titulo="Projetos por tipo" sub="(padrão) = card sem “Tipo de Projeto” no ClickUp">
          <Barras grupos={porTipo} legenda={<LegendaFarol />} />
        </Cartao>
      </div>

      <Cartao titulo="Lançamentos reprogramados" sub="campo “REPROGRAMAÇÕES” · motivos no histórico de cada card">
        {(() => {
          const rep = linhas.filter((r) => r.p.reprogramacoes > 0).sort((a, b) => b.p.reprogramacoes - a.p.reprogramacoes);
          if (!rep.length) return <p className="m-0 text-[13px] text-muted">Nenhuma onda reprogramada até agora.</p>;
          return (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px] tabular-nums">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wider text-muted">
                    {['Projeto', 'Onda original', 'Onda atual', 'Vezes'].map((h) => (
                      <th key={h} className="border-b border-line px-2 py-1.5 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rep.map((r) => (
                    <tr key={r.p.id}>
                      <td className="border-b border-line px-2 py-1.5">
                        <a className="hover:text-accent hover:underline" href={r.p.url} target="_blank" rel="noopener noreferrer">{r.p.nome}</a>
                      </td>
                      <td className="border-b border-line px-2 py-1.5 text-muted">{r.p.ondaOriginal ?? '—'}</td>
                      <td className="border-b border-line px-2 py-1.5">{r.p.onda ?? '—'}{r.p.ano ? ` - ${r.p.ano}` : ''}</td>
                      <td className="border-b border-line px-2 py-1.5 font-semibold text-warn">{r.p.reprogramacoes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </Cartao>
      <p className="text-xs text-muted">
        Contagens de projetos ativos (sem concluídos e cancelados). Os gráficos seguem os filtros do topo; passe o mouse nas barras para ver os
        números. “Projetos por fase” leva ao cronograma filtrado.
      </p>
    </div>
  );
}
