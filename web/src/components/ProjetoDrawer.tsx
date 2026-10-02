import { useEffect, useState } from 'react';
import type { Modelo, StatusLista } from '@shared/types';
import { saudeDesvio, type ProjetoCalc } from '../lib/calc';
import { deISO, dias, fmt } from '../lib/datas';
import { api } from '../lib/api';
import { Botao, Chip, Pill, Rotulo } from './ui';
import { FarolBadge } from './Farol';
import { FollowupComentario } from './FollowupComentario';
import { ImagemProduto } from './ImagemProduto';
import { ReprogramarOnda } from './ReprogramarOnda';
import { divergencia } from '../lib/farol';
import { calcularFarol } from '@shared/farol-auto';
import { regrasFarol } from '@shared/modelo-padrao';

export function ProjetoDrawer({
  r,
  modelo,
  hoje,
  aoFechar,
  aoMudar,
  editavel = true,
}: {
  r: ProjetoCalc;
  modelo: Modelo;
  hoje: number;
  aoFechar: () => void;
  aoMudar: () => void;
  /** false = modo leitura (sem mover fase, reprogramar ou comentar) */
  editavel?: boolean;
}) {
  const p = r.p;
  const [statusLista, setStatusLista] = useState<StatusLista[]>([]);
  const [novo, setNovo] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editavel) api.status().then(setStatusLista).catch(() => setStatusLista([]));
  }, [editavel]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aoFechar]);

  async function mover() {
    setEnviando(true);
    setMsg(null);
    try {
      await api.mudarStatus(p.id, novo);
      setMsg(`Status alterado para "${novo}" no ClickUp.`);
      setConfirmar(false);
      aoMudar();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const cur = !r.concluido && r.atuais.length ? r.fases[r.atuais[0]] : null;
  const campos: [string, string, boolean?][] = [
    ['Responsável', p.analistas.join(', ') || 'Sem responsável'],
    ['Tipo de projeto', `${r.tipo.nome}${r.tipoAssumido ? ' (padrão — preencha no ClickUp)' : ''} · lead time ${r.leadTime} d${r.dispensadas.length ? ' (com fases dispensadas)' : ''}`, true],
    ['Fases que não se aplicam', r.dispensadas.map((i) => r.fases[i].nome).join(', ') || '—'],
    ['Qtd. de itens (subitens)', p.itens?.toString() ?? '—'],
    ['Onda de lançamento', `${p.onda ?? '—'}${p.reprogramacoes ? ` (reprogramada ${p.reprogramacoes}x)` : ''}`],
    ['Ano de lançamento', p.ano ?? '—'],
    ['Forecast inicial', p.forecast == null ? '—' : p.forecast.toLocaleString('pt-BR')],
    ['Status no ClickUp', p.statusClickUp],
    ['Fase do projeto', r.atuais.map((i) => r.fases[i].nome).join(' + ') || 'Backlog', true],
    ['Início do lançamento (plan. → proj.)', `${fmt(r.lancPlan)} → ${fmt(r.lancProj)}`, true],
    ['Data inicial estimada', fmt(r.inicioPlan)],
    ['Conclusão estimada', fmt(r.fimPlan)],
    ['Data de lançamento (meta)', p.dataLancamentoMeta ? fmt(deISO(p.dataLancamentoMeta)) : '—'],
    ['Plano para hoje', r.esperadas.map((i) => r.fases[i].nome).join(' + ') || '—'],
    ['Data inicial real', p.inicioRealInformado ? fmt(deISO(p.inicioRealInformado)) : '—'],
    ['Conclusão atualizada', r.fimProj == null ? '—' : fmt(r.fimProj), true],
    ['Conclusão real', p.conclusaoRealInformada ? fmt(deISO(p.conclusaoRealInformada)) : '—'],
    ['Desvio na conclusão', r.desvio == null ? '—' : `${r.desvio > 0 ? '+' : ''}${r.desvio} dias`, true],
  ];

  return (
    <>
      <div className="fixed inset-0 z-20 bg-black/35" onClick={aoFechar} />
      <aside className="fixed inset-y-0 right-0 z-30 flex w-full max-w-[760px] flex-col gap-4 overflow-y-auto [&>*]:shrink-0 bg-surface p-5 shadow-2xl" aria-label="Detalhe do projeto">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
            {/* foto do produto (campo IMAGEM PRODUTO); o clique abre em tamanho real */}
            {p.imagem ? (
              <a
                href={p.imagem.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir imagem em tamanho real"
                className="block w-full flex-none cursor-zoom-in rounded-md transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent sm:w-auto"
              >
                <ImagemProduto p={p} grande className="h-44 w-full sm:h-[180px] sm:w-[240px]" />
              </a>
            ) : (
              <ImagemProduto p={p} grande className="h-24 w-full sm:h-[180px] sm:w-[240px]" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <Rotulo>
                {p.pvl ?? '—'} · {p.familia ?? '—'}
              </Rotulo>
              <h2 className="font-display text-2xl font-bold">{p.nome}</h2>
              <span className="flex flex-wrap items-center gap-2">
                <FarolBadge farol={p.farol} grande />
                <span className="text-xs text-muted">desvio calculado</span>
                <Pill saude={r.saude}>{r.saudeTxt}</Pill>
                <a className="text-[12.5px] font-semibold text-accent hover:underline" href={p.url} target="_blank" rel="noopener noreferrer">
                  Abrir no ClickUp ↗
                </a>
              </span>
            </div>
          </div>
          <Botao onClick={aoFechar}>Fechar</Botao>
        </header>

        {/* follow-up: farol + próximo passo */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-line px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Rotulo>Follow-up</Rotulo>
            <FarolBadge farol={p.farol} />
            {!p.farol && <span className="text-xs text-muted">Defina o farol no campo “Status do Projeto” do card.</span>}
          </div>
          <p className="m-0 text-[13px]">
            <span className="text-muted">Próximo passo: </span>
            {p.proximoPasso ?? <span className="text-muted">— (campo “PRÓXIMO PASSO” no ClickUp)</span>}
          </p>
          {(() => {
            const calc = calcularFarol(r, regrasFarol(modelo), hoje);
            if (!calc) return null;
            const igual = p.farol?.nome.toLowerCase() === calc.farol.toLowerCase();
            return (
              <p className="m-0 text-xs text-muted">
                Farol calculado: <Pill saude={calc.farol === 'Atrasado' ? 'bad' : calc.farol === 'Atenção' ? 'warn' : 'ok'}>{calc.farol}</Pill> — {calc.motivo}
                {!igual && (regrasFarol(modelo).ativo ? ' (será gravado no ClickUp na próxima atualização)' : ' (farol automático desligado)')}
              </p>
            );
          })()}
          {divergencia(p.farol, r.desvio) && <p className="m-0 text-xs text-warn">⚠ {divergencia(p.farol, r.desvio)}</p>}
        </div>

        {/* onda de lançamento + reprogramação com evidência no card */}
        {!r.cancelado && <ReprogramarOnda p={p} aoMudar={aoMudar} editavel={editavel} />}

        {/* tempo na fase atual × prazo */}
        {cur && cur.estado === 'atual' && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-sunk px-3 py-2.5">
            <Rotulo>Tempo na fase atual</Rotulo>
            {cur.rs != null ? (
              (() => {
                const na = dias(cur.rs, hoje);
                return <Pill saude={na <= cur.prazo ? 'ok' : na <= cur.prazo * 1.2 ? 'warn' : 'bad'}>{na} de {cur.prazo} dias</Pill>;
              })()
            ) : (
              <Pill saude={dias(cur.pe, hoje) > 0 ? 'bad' : 'ok'}>
                {dias(cur.pe, hoje) > 0 ? `plano encerrou esta fase há ${dias(cur.pe, hoje)} d` : 'dentro do plano'}
              </Pill>
            )}
            <small className="basis-full text-xs text-muted">
              {cur.rs != null ? `Desde ${fmt(cur.rs)} (registrado pelo ClickUp).` : 'Início anterior ao ClickUp — passa a contar na próxima mudança de status.'}
            </small>
          </div>
        )}

        {/* mover fase no ClickUp */}
        {editavel && !r.cancelado && statusLista.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg bg-accent-soft px-3 py-2.5">
            <Rotulo>Mover fase no ClickUp</Rotulo>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
                value={novo}
                onChange={(e) => {
                  setNovo(e.target.value);
                  setConfirmar(false);
                }}
              >
                <option value="">Escolha o novo status…</option>
                {statusLista
                  .filter((s) => s.status !== p.statusClickUp)
                  .map((s) => (
                    <option key={s.status} value={s.status}>
                      {s.status}
                    </option>
                  ))}
              </select>
              {novo && !confirmar && <Botao onClick={() => setConfirmar(true)}>Mover</Botao>}
              {confirmar && (
                <>
                  <span className="text-sm">
                    Mover de <b>{p.statusClickUp}</b> para <b>{novo}</b>?
                  </span>
                  <Botao primario disabled={enviando} onClick={mover}>
                    Confirmar
                  </Botao>
                  <Botao onClick={() => setConfirmar(false)}>Cancelar</Botao>
                </>
              )}
            </div>
            {msg && <small className="text-xs text-muted">{msg}</small>}
          </div>
        )}

        {/* follow-up com a pessoa: comentário no card (♦️DATA / ♦️Comentário), sem mexer nos campos */}
        <FollowupComentario key={p.id} p={p} editavel={editavel} />

        <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {campos.map(([k, v, destaque]) => (
            <div key={k} className="flex flex-col border-b border-line pb-1.5">
              <dt>
                <Rotulo>{k}</Rotulo>
              </dt>
              <dd className={`m-0 tabular-nums ${destaque ? 'font-semibold' : ''}`}>{v}</dd>
            </div>
          ))}
        </dl>

        <h3 className="font-display text-base font-bold uppercase">Fase a fase — planejado × real</h3>
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse text-[12.5px] tabular-nums">
            <thead>
              <tr className="bg-sunk text-left text-[10.5px] uppercase tracking-wider text-muted">
                {['Fase', 'Prazo', 'Plan. início', 'Plan. fim', 'Real início', 'Real fim', 'Desvio'].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-line px-2 py-1.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.fases.map((f) => {
                const fimRef = f.estado === 'feito' ? f.re : f.estado === 'atual' ? f.fimPrevisto : f.xe;
                const dv = fimRef == null ? null : dias(f.pe, fimRef);
                const semData = <span className="text-[10.5px] text-muted">antes do ClickUp</span>;
                if (f.estado === 'dispensada')
                  return (
                    <tr key={f.i} className="text-muted">
                      <td className="whitespace-nowrap border-b border-line px-2 py-1.5 opacity-60">
                        <s>{f.nome}</s>
                      </td>
                      <td colSpan={6} className="border-b border-line px-2 py-1.5 text-[11.5px] italic">
                        não se aplica a este projeto (FASES DISPENSADAS)
                      </td>
                    </tr>
                  );
                return (
                  <tr key={f.i} className={f.estado === 'atual' ? 'bg-accent-soft' : ''}>
                    <td className="whitespace-nowrap border-b border-line px-2 py-1.5">
                      <Chip cor={f.cor}>{f.nome}</Chip>
                      {f.nslot > 1 && <span className="ml-1 font-mono text-[11px] text-muted">∥</span>}
                      {f.pulada && (
                        <span className="ml-1 text-[10.5px] text-warn" title="O card pulou esta fase no ClickUp. Se foi combinado, marque em FASES DISPENSADAS.">
                          pulada
                        </span>
                      )}
                    </td>
                    <td className="border-b border-line px-2 py-1.5 font-mono text-[11.5px]">{f.prazo} d</td>
                    <td className="border-b border-line px-2 py-1.5 font-mono text-[11.5px]">{fmt(f.ps)}</td>
                    <td className="border-b border-line px-2 py-1.5 font-mono text-[11.5px]">{fmt(f.pe)}</td>
                    <td className="border-b border-line px-2 py-1.5 font-mono text-[11.5px]">
                      {f.rs != null ? fmt(f.rs) : f.estado !== 'futuro' ? semData : '—'}
                    </td>
                    <td className="border-b border-line px-2 py-1.5 font-mono text-[11.5px]">
                      {f.estado === 'atual' ? <em>em curso</em> : f.re != null ? fmt(f.re) : f.estado === 'feito' ? semData : '—'}
                    </td>
                    <td className="border-b border-line px-2 py-1.5">
                      {dv == null ? '—' : <Pill saude={saudeDesvio(dv)}>{`${dv > 0 ? '+' : ''}${dv} d`}</Pill>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="max-w-[75ch] text-[12.5px] text-muted">
          Cada mudança de status no ClickUp vira o fim real de uma fase e o início da próxima. Esta tela relê o ClickUp a cada 2 minutos.
        </p>
      </aside>
    </>
  );
}
