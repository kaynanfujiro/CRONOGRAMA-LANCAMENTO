import { useEffect, useMemo, useRef } from 'react';
import type { FaseCalc, ProjetoCalc } from '../lib/calc';
import { DIA, MESES, dias, fmt, segunda, semanaISO } from '../lib/datas';
import { Chip, Pill } from './ui';
import { FarolBadge } from './Farol';
import { faixaFarol, tomFarol } from '../lib/farol';

const LARGURA_ROTULO = 290;

/** Posição vertical das barras: planejado (fino) em cima, real/projeção embaixo; fases paralelas dividem a raia. */
function geo(tipo: 'plan' | 'real', f: FaseCalc) {
  if (tipo === 'plan') return f.nslot > 1 ? { top: 7 + f.slot * 6, h: 4 } : { top: 9, h: 6 };
  return f.nslot > 1 ? { top: 22 + f.slot * 10, h: 9 } : { top: 22, h: 18 };
}

export function Gantt({
  linhas,
  hoje,
  zoom,
  aoAbrir,
}: {
  linhas: ProjetoCalc[];
  hoje: number;
  zoom: number;
  aoAbrir: (id: string) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);

  const { ini, fim } = useMemo(() => {
    if (!linhas.length) return { ini: hoje, fim: hoje };
    let mn = Math.min(...linhas.map((r) => r.inicioPlan));
    let mx = Math.max(...linhas.map((r) => Math.max(r.fimPlan, r.fimProj ?? 0, hoje)));
    const a = new Date(mn);
    a.setUTCDate(1);
    mn = segunda(a.getTime());
    const b = new Date(mx);
    b.setUTCMonth(b.getUTCMonth() + 1, 1);
    mx = b.getTime();
    return { ini: mn, fim: mx };
  }, [linhas, hoje]);

  const x = (t: number) => ((t - ini) / DIA) * zoom;
  const W = Math.round(dias(ini, fim) * zoom);
  const xHoje = x(hoje);

  // rola até "hoje" ao abrir e ao trocar a escala
  useEffect(() => {
    const el = caixa.current;
    if (el) el.scrollLeft = Math.max(0, xHoje + LARGURA_ROTULO - el.clientWidth * 0.5);
  }, [zoom, ini]); // eslint-disable-line react-hooks/exhaustive-deps

  const meses: { l: number; w: number; txt: string; agora: boolean }[] = [];
  for (let m = new Date(ini); m.getTime() < fim; ) {
    m.setUTCDate(1);
    const n = new Date(m);
    n.setUTCMonth(n.getUTCMonth() + 1);
    const a = Math.max(m.getTime(), ini);
    const b = Math.min(n.getTime(), fim);
    meses.push({
      l: x(a),
      w: x(b) - x(a),
      txt: `${MESES[m.getUTCMonth()]}/${String(m.getUTCFullYear()).slice(2)}`,
      agora: hoje >= m.getTime() && hoje < n.getTime(),
    });
    m.setTime(n.getTime());
  }
  const passo = zoom * 7 < 18 ? 4 : 1;
  const semanas: { l: number; w: number; n: number; agora: boolean; t: number }[] = [];
  for (let t = ini, k = 0; t < fim; t += 7 * DIA, k++) {
    if (k % passo) continue;
    semanas.push({ l: x(t), w: 7 * zoom * passo, n: semanaISO(t), agora: hoje >= t && hoje < t + 7 * DIA, t });
  }

  if (!linhas.length)
    return <div className="rounded-lg border border-line bg-surface p-7 text-center text-muted">Nenhum projeto com esses filtros.</div>;

  const Barra = ({ f, tipo, a, b, cls, titulo }: { f: FaseCalc; tipo: 'plan' | 'real'; a: number; b: number; cls: string; titulo: string }) => {
    const g = geo(tipo, f);
    return (
      <div
        className={`absolute rounded-[2px] ${cls}`}
        title={titulo}
        style={{ ['--c' as string]: f.cor, background: cls.includes('barra-proj') ? undefined : f.cor, left: x(a), width: Math.max(2, x(b) - x(a)), top: g.top, height: g.h }}
      />
    );
  };

  return (
    <div ref={caixa} className="relative max-h-[72vh] overflow-auto rounded-lg border border-line bg-surface" style={{ ['--wk' as string]: `${7 * zoom}px` }}>
      <div className="relative" style={{ width: LARGURA_ROTULO + W }}>
        {/* cabeçalho */}
        <div className="sticky top-0 z-10 flex border-b border-line bg-surface">
          <div className="sticky left-0 z-20 flex flex-none items-end border-r border-line bg-surface px-3 py-2 font-display text-sm uppercase text-accent" style={{ width: LARGURA_ROTULO }}>
            Projeto
          </div>
          <div className="relative h-12 flex-none" style={{ width: W }}>
            {meses.map((m) => (
              <div key={m.txt} className={`absolute top-0 h-[22px] overflow-hidden whitespace-nowrap border-l border-line px-1.5 py-[3px] text-[11px] font-semibold ${m.agora ? 'bg-accent text-white' : 'text-muted'}`} style={{ left: m.l, width: m.w }}>
                {m.txt}
              </div>
            ))}
            {semanas.map((s) => (
              <div key={s.t} title={`Semana ${s.n} · ${fmt(s.t)}`} className={`absolute top-6 h-[22px] border-l border-line pt-1 text-center font-mono text-[10px] tabular-nums ${s.agora ? 'font-bold text-accent' : 'text-muted'}`} style={{ left: s.l, width: s.w }}>
                {s.n}
              </div>
            ))}
            <div className="absolute top-0 z-10 -translate-x-1/2 rounded-b bg-accent px-1.5 font-mono text-[10px] font-semibold text-white" style={{ left: xHoje }}>
              hoje
            </div>
          </div>
        </div>

        {/* linhas */}
        {linhas.map((r) => (
          <div key={r.p.id} className={`group flex min-h-16 border-b border-line ${r.cancelado ? 'opacity-45' : ''}`}>
            <button
              type="button"
              onClick={() => aoAbrir(r.p.id)}
              className="sticky left-0 z-[5] flex flex-none flex-col justify-center gap-[3px] border-r border-line bg-surface py-2 pl-4 pr-3 text-left group-hover:bg-sunk focus-visible:outline-2 focus-visible:outline-accent"
              style={{ width: LARGURA_ROTULO }}
            >
              {/* faixa do farol */}
              <i className={`absolute inset-y-0 left-0 w-1.5 ${faixaFarol[tomFarol(r.p.farol)]}`} aria-hidden />
              <span className="text-[13px] font-semibold leading-tight">{r.p.nome}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                <FarolBadge farol={r.p.farol} />
                <span title="Desvio calculado na conclusão (planejado × projeção)">
                  <Pill saude={r.saude}>{r.saudeTxt}</Pill>
                </span>
              </span>
              <span className="text-[11.5px] text-muted">
                {r.p.analistas.join(', ') || 'Sem responsável'} · {r.p.onda ?? '—'}
                {r.p.reprogramacoes > 0 && (
                  <span className="ml-1 font-semibold text-warn" title={`Onda reprogramada ${r.p.reprogramacoes}x${r.p.ondaOriginal ? ` — original: ${r.p.ondaOriginal}` : ''}`}>
                    ↻{r.p.reprogramacoes}
                  </span>
                )}{' '}
                · <span title={r.tipoAssumido ? 'Tipo padrão — card sem Tipo de Projeto no ClickUp' : 'Tipo de projeto'} className={r.tipoAssumido ? 'italic' : ''}>{r.tipo.nome.replace('Ampliação de ', 'Ampl. ')}</span>
              </span>
              <span className="flex flex-wrap gap-1.5 text-[11.5px] text-muted">
                {r.atuais.length ? r.atuais.map((i) => <Chip key={i} cor={r.fases[i].cor}>{r.fases[i].nome}</Chip>) : <em>Aguardando início</em>}
              </span>
              {!r.cancelado && !r.concluido && r.esperadas.length > 0 && (
                <span className="text-[11px] italic text-muted">Plano p/ hoje: {r.esperadas.map((i) => r.fases[i].nome).join(' + ')}</span>
              )}
              {r.dispensadas.length > 0 && (
                <span className="text-[11px] text-muted" title="Campo “FASES DISPENSADAS” no ClickUp — essas fases não entram no cronograma deste projeto">
                  Não se aplica: <s>{r.dispensadas.map((i) => r.fases[i].nome).join(', ')}</s>
                </span>
              )}
              {r.p.puladas?.length > 0 && (
                <span className="text-[11px] text-warn" title="O card mudou de status pulando estas fases. Se foi combinado, marque-as em “FASES DISPENSADAS” no ClickUp.">
                  ⚠ Pulou: {r.p.puladas.map((i) => r.fases[i].nome).join(', ')}
                </span>
              )}
            </button>
            <div className="grade-semanas relative flex-none group-hover:bg-sunk" style={{ width: W }}>
              <span className="absolute left-1 top-[5px] font-mono text-[9px] text-muted">P</span>
              <span className="absolute left-1 top-[26px] font-mono text-[9px] text-muted">R</span>
              {r.fases.map((f) => {
                if (f.estado === 'dispensada') return null;
                const barras = [
                  <Barra key="p" f={f} tipo="plan" a={f.ps} b={f.pe} cls="opacity-50" titulo={`${f.nome} · planejado ${fmt(f.ps)} → ${fmt(f.pe)} (${f.prazo} d)`} />,
                ];
                if (f.estado === 'feito' && f.rs != null && f.re != null)
                  barras.push(<Barra key="r" f={f} tipo="real" a={f.rs} b={f.re} cls="" titulo={`${f.nome} · real ${fmt(f.rs)} → ${fmt(f.re)} (${dias(f.rs, f.re)} d de ${f.prazo})`} />);
                if (f.estado === 'atual') {
                  if (f.rs == null) {
                    // início anterior ao ClickUp: pinta só a semana de hoje
                    const ws = segunda(hoje);
                    const we = ws + 7 * DIA;
                    barras.push(<Barra key="r" f={f} tipo="real" a={ws} b={we} cls="shadow-[inset_0_0_0_1.5px_rgba(0,0,0,.35)]" titulo={`${f.nome} · fase atual (início não registrado)`} />);
                    if (!r.cancelado && f.fimPrevisto! > we)
                      barras.push(<Barra key="x" f={f} tipo="real" a={we} b={f.fimPrevisto!} cls="barra-proj" titulo={`${f.nome} · restante previsto até ${fmt(f.fimPrevisto)}`} />);
                  } else {
                    barras.push(<Barra key="r" f={f} tipo="real" a={f.rs} b={r.cancelado ? Math.min(hoje, f.fimPrevisto!) : hoje} cls="shadow-[inset_0_0_0_1.5px_rgba(0,0,0,.35)]" titulo={`${f.nome} · em andamento desde ${fmt(f.rs)} (${dias(f.rs, hoje)} d de ${f.prazo})`} />);
                    if (!r.cancelado && f.fimPrevisto! > hoje)
                      barras.push(<Barra key="x" f={f} tipo="real" a={hoje} b={f.fimPrevisto!} cls="barra-proj" titulo={`${f.nome} · restante previsto até ${fmt(f.fimPrevisto)}`} />);
                  }
                }
                if (f.xs != null && f.xe != null)
                  barras.push(<Barra key="f" f={f} tipo="real" a={f.xs} b={f.xe} cls="barra-proj" titulo={`${f.nome} · projeção ${fmt(f.xs)} → ${fmt(f.xe)}`} />);
                return <div key={f.i}>{barras}</div>;
              })}
              <div className="pointer-events-none absolute inset-y-0 z-[2] w-0.5 bg-accent" style={{ left: xHoje }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
