/**
 * Exportação em PDF "por Onda": escolhe as ondas, monta o relatório em A4 deitado e abre a janela de
 * impressão do navegador ("Salvar como PDF"). Não altera nada — funciona também no modo leitura.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ProjetoCalc, Saude } from '../lib/calc';
import { dias, fmt } from '../lib/datas';
import { FAROIS, nomeFarol, tomFarol } from '../lib/farol';
import { Botao } from './ui';

const SEM_ONDA = 'Sem onda';
const rotuloOnda = (r: ProjetoCalc) => (r.p.onda ? `${r.p.onda}${r.p.ano ? ' · ' + r.p.ano : ''}` : SEM_ONDA);

/** Ondas das mais próximas para as mais distantes: ano, depois número da onda ("ONDA 2" antes de "ONDA 10"). */
function ordemOnda(a: string, b: string) {
  if (a === SEM_ONDA) return 1;
  if (b === SEM_ONDA) return -1;
  const chave = (s: string) => {
    const ano = Number(s.match(/(\d{4})\s*$/)?.[1] ?? 9999);
    const num = Number(s.match(/onda\s*(\d+)/i)?.[1] ?? 999);
    return ano * 1000 + num;
  };
  return chave(a) - chave(b) || a.localeCompare(b);
}

const CORES: Record<Saude, string> = {
  ok: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  neutral: 'bg-sunk text-muted',
};
const Pilula = ({ s, children }: { s: Saude; children: React.ReactNode }) => (
  <span className={`inline-block whitespace-nowrap rounded-full px-1.5 text-[9.5px] font-bold ${CORES[s]}`}>{children}</span>
);
const Fases = ({ r, idx }: { r: ProjetoCalc; idx: number[] }) =>
  idx.length ? (
    <span className="flex flex-col gap-px">
      {idx.map((i) => (
        <span key={i} className="inline-flex items-center gap-1 whitespace-nowrap">
          <i className="inline-block h-2 w-2 rounded-[2px]" style={{ background: r.fases[i].cor }} />
          {r.fases[i].nome}
        </span>
      ))}
    </span>
  ) : (
    <span className="text-muted">—</span>
  );

/** Status real, dias na etapa e status da etapa (mesma regra do detalhe do projeto). */
function etapa(r: ProjetoCalc, hoje: number): { real: number[]; textoReal?: string; dias: string; status: [Saude, string] } {
  if (r.cancelado) return { real: [], textoReal: 'Cancelado', dias: '—', status: ['neutral', 'Cancelado'] };
  if (r.concluido) return { real: r.atuais, textoReal: undefined, dias: '—', status: ['ok', 'Lançado'] };
  if (r.semInfo) return { real: [], textoReal: 'Backlog', dias: '—', status: ['neutral', 'Não iniciado'] };
  const cur = r.atuais.length ? r.fases[r.atuais[0]] : null;
  if (!cur || cur.estado !== 'atual') return { real: r.atuais, dias: '—', status: ['neutral', '—'] };
  if (cur.rs != null) {
    const na = dias(cur.rs, hoje);
    const s: Saude = na <= cur.prazo ? 'ok' : na <= cur.prazo * 1.2 ? 'warn' : 'bad';
    return { real: r.atuais, dias: `${na} de ${cur.prazo}`, status: [s, s === 'ok' ? 'No prazo' : s === 'warn' ? 'Atenção' : 'Atrasado'] };
  }
  const passou = dias(cur.pe, hoje);
  return {
    real: r.atuais,
    dias: `? de ${cur.prazo}`,
    status: passou > 0 ? ['bad', 'Atrasado'] : ['ok', 'No prazo'],
  };
}

export function ExportarPdf({ todas, filtradas, hoje }: { todas: ProjetoCalc[]; filtradas: ProjetoCalc[]; hoje: number }) {
  const ondas = useMemo(() => [...new Set(todas.map(rotuloOnda))].sort(ordemOnda), [todas]);
  const [aberto, setAberto] = useState(false);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [usarFiltros, setUsarFiltros] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const relatorio = useRef<HTMLDivElement>(null);

  // padrão ao abrir: as 2 ondas mais próximas
  function abrir() {
    setMarcadas((m) => (m.length ? m.filter((o) => ondas.includes(o)) : ondas.filter((o) => o !== SEM_ONDA).slice(0, 2)));
    setAberto(true);
  }
  const alternar = (o: string) => setMarcadas((m) => (m.includes(o) ? m.filter((x) => x !== o) : [...m, o]));

  const base = usarFiltros ? filtradas : todas;
  const grupos = useMemo(() => {
    const peso = (r: ProjetoCalc) => FAROIS.indexOf(nomeFarol(r.p.farol));
    return ondas
      .filter((o) => marcadas.includes(o))
      .map((o) => ({
        onda: o,
        linhas: base
          .filter((r) => rotuloOnda(r) === o)
          .sort((a, b) => peso(a) - peso(b) || (b.desvio ?? -1e9) - (a.desvio ?? -1e9) || a.p.nome.localeCompare(b.p.nome)),
      }))
      .filter((g) => g.linhas.length);
  }, [ondas, marcadas, base]);
  const total = grupos.reduce((s, g) => s + g.linhas.length, 0);
  const contar = (ls: ProjetoCalc[]) => {
    const c = { 'No Prazo': 0, Atenção: 0, Atrasado: 0, 'Sem farol': 0 } as Record<string, number>;
    ls.forEach((r) => c[nomeFarol(r.p.farol)]++);
    return c;
  };
  const geral = contar(grupos.flatMap((g) => g.linhas));

  // espera as imagens carregarem e abre a janela de impressão
  useEffect(() => {
    if (!imprimindo) return;
    const imgs = [...(relatorio.current?.querySelectorAll('img') ?? [])];
    const prontas = imgs.map((i) =>
      i.complete ? Promise.resolve() : new Promise<void>((ok) => ((i.onload = () => ok()), (i.onerror = () => ok()))),
    );
    const tituloAntes = document.title;
    let cancelado = false;
    Promise.race([Promise.all(prontas), new Promise((ok) => setTimeout(ok, 8000))]).then(() => {
      if (cancelado) return;
      // nome sugerido do arquivo PDF
      document.title = `Cronograma por Onda - ${fmt(hoje).replace(/\//g, '-')}`;
      window.print();
      document.title = tituloAntes;
      setImprimindo(false);
    });
    return () => {
      cancelado = true;
      document.title = tituloAntes;
    };
  }, [imprimindo, hoje]);

  const geradoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <>
      <Botao onClick={abrir}>Exportar PDF</Botao>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40 bg-black/35 print:hidden" onClick={() => setAberto(false)} />
          <div
            role="dialog"
            aria-label="Exportar PDF por onda"
            className="fixed left-1/2 top-24 z-50 flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-3 rounded-lg bg-surface p-5 shadow-2xl print:hidden"
            onKeyDown={(e) => e.key === 'Escape' && setAberto(false)}
          >
            <h2 className="m-0 font-display text-xl font-bold uppercase">Exportar PDF · por Onda</h2>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Ondas</span>
              <span className="flex gap-3 text-xs">
                <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setMarcadas(ondas)}>
                  Todas
                </button>
                <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setMarcadas([])}>
                  Nenhuma
                </button>
              </span>
            </div>
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border border-line p-2">
              {ondas.map((o) => {
                const n = (usarFiltros ? filtradas : todas).filter((r) => rotuloOnda(r) === o).length;
                return (
                  <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-sunk">
                    <input type="checkbox" className="accent-[var(--accent)]" checked={marcadas.includes(o)} onChange={() => alternar(o)} />
                    <span className="flex-1">{o}</span>
                    <span className="text-xs text-muted tabular-nums">{n} projeto{n === 1 ? '' : 's'}</span>
                  </label>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" className="accent-[var(--accent)]" checked={usarFiltros} onChange={(e) => setUsarFiltros(e.target.checked)} />
              Aplicar também os filtros da tela (responsável, farol, fase…)
            </label>
            <div className="flex items-center gap-2">
              <Botao primario disabled={!total || imprimindo} onClick={() => setImprimindo(true)}>
                {imprimindo ? 'Preparando…' : `Gerar PDF (${total} projeto${total === 1 ? '' : 's'})`}
              </Botao>
              <Botao onClick={() => setAberto(false)}>Fechar</Botao>
            </div>
            <small className="text-[11px] text-muted">Na janela que abrir, escolha o destino “Salvar como PDF”. A folha já vem em A4 deitado.</small>
          </div>
        </>
      )}

      {/* relatório: invisível na tela, é o que vai para o PDF */}
      {imprimindo &&
        createPortal(
          <div ref={relatorio} className="relatorio-pdf text-ink">
            <div className="flex items-end justify-between border-b-[3px] border-accent pb-1.5">
              <div className="flex items-end gap-3">
                <img src="/logo-cortag.svg" alt="Cortag" className="h-8 w-auto" />
                <b className="font-display text-[18px] uppercase leading-none text-accent">Cronograma de Lançamentos · por Onda</b>
              </div>
              <span className="text-[10px] text-muted">
                Gerado em {geradoEm} · {grupos.map((g) => g.onda).join(', ')}
                {usarFiltros && ' · com filtros da tela'}
              </span>
            </div>

            <div className="my-2 flex gap-2">
              {[
                ['Projetos', total, 'text-ink'],
                ['No prazo', geral['No Prazo'], 'text-good'],
                ['Atenção', geral['Atenção'], 'text-warn'],
                ['Atrasados', geral['Atrasado'], 'text-bad'],
                ['Sem farol', geral['Sem farol'], 'text-muted'],
              ].map(([t, n, c]) => (
                <div key={t as string} className="flex-1 rounded border border-line px-2 py-1">
                  <b className={`block text-[16px] leading-tight ${c}`}>{n}</b>
                  <span className="text-[8.5px] uppercase tracking-wider text-muted">{t}</span>
                </div>
              ))}
            </div>

            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="text-left text-[8.5px] uppercase tracking-wider text-muted">
                  {['', 'Projeto', 'PVL', 'Status proposto', 'Status real', 'Dias na etapa', 'Status da etapa', 'Farol', 'Desvio'].map((h) => (
                    <th key={h} className="border-b border-line px-1 py-1 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              {grupos.map((g) => {
                const c = contar(g.linhas);
                return (
                  <tbody key={g.onda}>
                    <tr className="grupo-onda">
                      <td colSpan={9} className="bg-sunk px-2 py-1 text-[10.5px] font-bold">
                        <span className="flex justify-between">
                          <span className="uppercase">{g.onda}</span>
                          <span>
                            {g.linhas.length} projeto{g.linhas.length === 1 ? '' : 's'} · {c['Atrasado']} atrasado{c['Atrasado'] === 1 ? '' : 's'} ·{' '}
                            {c['Atenção']} em atenção · {c['No Prazo']} no prazo
                          </span>
                        </span>
                      </td>
                    </tr>
                    {g.linhas.map((r) => {
                      const e = etapa(r, hoje);
                      return (
                        <tr key={r.p.id} className="linha-pdf">
                          <td className="w-[34px] border-b border-line px-1 py-[3px]">
                            <span className="flex h-[26px] w-[30px] items-center justify-center overflow-hidden rounded-[3px] border border-line bg-white">
                              {r.p.imagem && <img src={r.p.imagem.miniatura} alt="" className="max-h-full max-w-full object-contain" />}
                            </span>
                          </td>
                          <td className="border-b border-line px-1 py-[3px] font-semibold">{r.p.nome}</td>
                          <td className="whitespace-nowrap border-b border-line px-1 py-[3px]">{r.p.pvl ?? '—'}</td>
                          <td className="border-b border-line px-1 py-[3px]">{r.cancelado || r.concluido ? <span className="text-muted">—</span> : <Fases r={r} idx={r.esperadas} />}</td>
                          <td className="border-b border-line px-1 py-[3px]">{e.textoReal ? <b>{e.textoReal}</b> : <Fases r={r} idx={e.real} />}</td>
                          <td className="whitespace-nowrap border-b border-line px-1 py-[3px] tabular-nums">{e.dias}</td>
                          <td className="border-b border-line px-1 py-[3px]">
                            <Pilula s={e.status[0]}>{e.status[1]}</Pilula>
                          </td>
                          <td className="border-b border-line px-1 py-[3px]">
                            <Pilula s={tomFarol(r.p.farol)}>{nomeFarol(r.p.farol)}</Pilula>
                          </td>
                          <td className="whitespace-nowrap border-b border-line px-1 py-[3px] tabular-nums">
                            <Pilula s={r.saude}>{r.saudeTxt}</Pilula>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
            <p className="mt-2 text-[8.5px] text-muted">
              Status proposto = fase prevista para hoje pelo plano (início do card + lead time do tipo) · Status real = fase atual no ClickUp ·
              Dias na etapa = dias na fase atual × prazo da fase (“?” = início anterior ao ClickUp) · Desvio = conclusão projetada × planejada ·
              Fonte: ClickUp, {fmt(hoje)}.
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}
