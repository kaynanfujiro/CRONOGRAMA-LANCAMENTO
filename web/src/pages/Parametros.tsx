/**
 * Parâmetros: lead time por tipo de projeto.
 * Cada linha é um tipo; cada célula é um bloco (uma ou mais fases que correm juntas,
 * como as células mescladas da planilha). O número é o prazo do bloco em dias.
 */
import type { Modelo, TipoProjeto } from '@shared/types';
import { leadTimeTipo } from '@shared/modelo-padrao';
import type { ProjetoCalc } from '../lib/calc';
import { Pill, Rotulo } from '../components/ui';
import { FarolAutoPainel } from '../components/FarolAutoPainel';

const meses = (d: number) => (d / 30.44).toFixed(1).replace('.', ',');

export function Parametros({
  modelo,
  alterar,
  salvando,
  erro,
  linhas,
}: {
  modelo: Modelo;
  alterar: (m: Modelo) => void;
  salvando: boolean;
  erro: string | null;
  linhas: ProjetoCalc[];
}) {
  const setTipo = (id: string, novo: TipoProjeto) =>
    alterar({ ...modelo, tipos: modelo.tipos.map((t) => (t.id === id ? novo : t)) });

  const semTipo = linhas.filter((r) => r.tipoAssumido).length;
  const padrao = modelo.tipos.find((t) => t.id === modelo.tipoPadrao);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Lead time por tipo de projeto</h2>
        <p className="max-w-[80ch] text-[13px] text-muted">
          O planejado de cada projeto = <b className="text-ink">Data de início do card</b> + os prazos do seu{' '}
          <b className="text-ink">Tipo de Projeto</b> (campo no ClickUp). Células que ocupam mais de uma fase são fases que
          correm juntas no mesmo período. Mude um número e o cronograma inteiro se recalcula — fica salvo no servidor, para todos.
          {salvando && <span className="ml-2 text-accent">salvando…</span>}
        </p>
        {erro && <p className="text-[13px] text-bad">Não foi possível salvar: {erro}</p>}
      </section>

      {/* resumo dos tipos */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {modelo.tipos.map((t) => {
          const total = leadTimeTipo(t);
          const n = linhas.filter((r) => r.tipo.id === t.id).length;
          return (
            <div key={t.id} className="flex flex-col gap-1 rounded-lg border border-l-4 border-line border-l-accent bg-surface px-4 py-3">
              <span className="text-[13px] font-semibold">{t.nome}</span>
              <span className="flex items-baseline gap-2">
                <b className="font-display text-[30px] leading-none tabular-nums text-accent">{total} d</b>
                <span className="text-xs text-muted">≈ {meses(total)} meses · referência {t.referencia}</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-muted">
                {n} projeto{n === 1 ? '' : 's'}
                <Pill saude={total > t.meta ? 'bad' : 'ok'}>{total > t.meta ? `+${total - t.meta} d da meta` : `dentro da meta (${t.meta} d)`}</Pill>
              </span>
            </div>
          );
        })}
      </section>

      {/* tabela editável — igual à planilha */}
      <section className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[1100px] border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] w-[200px] border-b border-r border-line bg-surface px-3 py-2 text-left">
                <Rotulo>Tipo de projeto</Rotulo>
              </th>
              {modelo.fases.map((f) => (
                <th key={f.nome} className="border-b border-line px-1 py-2 align-bottom" style={{ minWidth: 72 }}>
                  <span className="flex flex-col items-center gap-1 text-[10.5px] font-semibold uppercase leading-tight text-muted">
                    <i className="block h-2 w-full rounded-sm" style={{ background: f.cor }} />
                    {f.nome}
                  </span>
                </th>
              ))}
              <th className="border-b border-l border-line px-3 py-2 text-right">
                <Rotulo>Total</Rotulo>
              </th>
            </tr>
          </thead>
          <tbody>
            {modelo.tipos.map((t) => {
              const total = leadTimeTipo(t);
              return (
                <LinhaTipo
                  key={t.id}
                  tipo={t}
                  total={total}
                  padrao={modelo.tipoPadrao === t.id}
                  aoAlterar={(novo) => setTipo(t.id, novo)}
                  aoPadrao={() => alterar({ ...modelo, tipoPadrao: t.id })}
                />
              );
            })}
          </tbody>
        </table>
      </section>

      <FarolAutoPainel modelo={modelo} alterar={alterar} />

      <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-[13px]">
        <Rotulo>Como usar</Rotulo>
        <ul className="m-0 list-disc space-y-1 pl-5 text-muted">
          <li>
            <b className="text-ink">Prazo:</b> digite os dias de cada bloco.
          </li>
          <li>
            <b className="text-ink">Juntar / separar fases:</b> use <b className="text-ink">⇥ juntar</b> para fazer um bloco correr junto com o
            seguinte, e <b className="text-ink">separar</b> para desfazer.
          </li>
          <li>
            <b className="text-ink">Tipo padrão</b> ({padrao?.nome}): usado nos projetos sem “Tipo de Projeto” no ClickUp —{' '}
            {semTipo ? <b className="text-warn">hoje são {semTipo}</b> : 'hoje nenhum'}. Preencha o campo no ClickUp para usar o prazo certo.
          </li>
          <li>
            <b className="text-ink">Projeto fora da curva:</b> marque no card o campo <b className="text-ink">FASES DISPENSADAS</b> (Rótulos) com as fases
            que não se aplicam. Elas somem do planejado e do real; se todas as fases de um bloco forem dispensadas, o prazo do bloco sai do lead
            time do projeto. Hoje {linhas.filter((r) => r.dispensadas.length).length} projeto(s) usam isso.
          </li>
        </ul>
      </section>
    </div>
  );
}

function LinhaTipo({
  tipo,
  total,
  padrao,
  aoAlterar,
  aoPadrao,
}: {
  tipo: TipoProjeto;
  total: number;
  padrao: boolean;
  aoAlterar: (t: TipoProjeto) => void;
  aoPadrao: () => void;
}) {
  const setDias = (k: number, dias: number) =>
    aoAlterar({ ...tipo, blocos: tipo.blocos.map((b, j) => (j === k ? { ...b, dias: Math.max(0, dias || 0) } : b)) });

  // juntar o bloco k com o próximo (prazo = maior dos dois)
  const juntar = (k: number) => {
    const a = tipo.blocos[k];
    const b = tipo.blocos[k + 1];
    const novo = [...tipo.blocos];
    novo.splice(k, 2, { fases: [...a.fases, ...b.fases], dias: Math.max(a.dias, b.dias) });
    aoAlterar({ ...tipo, blocos: novo });
  };
  // separar um bloco em fases individuais (cada uma com o prazo do bloco)
  const separar = (k: number) => {
    const a = tipo.blocos[k];
    const novo = [...tipo.blocos];
    novo.splice(k, 1, ...a.fases.map((f) => ({ fases: [f], dias: a.dias })));
    aoAlterar({ ...tipo, blocos: novo });
  };

  const inp = 'w-14 rounded border border-line bg-bg px-1.5 py-1 text-center font-mono text-[13px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <>
      <tr>
        <th rowSpan={2} className="sticky left-0 z-[1] border-b border-r border-line bg-surface px-3 py-2 text-left align-top">
          <span className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">{tipo.nome}</span>
            <span className="text-[11px] font-normal text-muted">ref. {tipo.referencia}</span>
            <label className="flex items-center gap-1.5 text-[11px] font-normal text-muted">
              Meta
              <input
                type="number"
                className="w-16 rounded border border-line bg-bg px-1 py-0.5 text-right font-mono text-[11px]"
                value={tipo.meta}
                onChange={(e) => aoAlterar({ ...tipo, meta: Math.max(0, +e.target.value || 0) })}
              />
              d
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-normal text-muted">
              <input type="radio" name="tipoPadrao" checked={padrao} onChange={aoPadrao} />
              tipo padrão
            </label>
          </span>
        </th>
        {tipo.blocos.map((b, k) => (
          <td
            key={k}
            colSpan={b.fases.length}
            className={`border-b border-l border-line px-1 pt-2 text-center ${b.fases.length > 1 ? 'bg-accent-soft' : ''}`}
          >
            <input
              type="number"
              min={0}
              max={999}
              className={inp}
              value={b.dias}
              aria-label={`Prazo do bloco ${b.fases.join('+')} (${tipo.nome})`}
              onChange={(e) => setDias(k, +e.target.value)}
            />
          </td>
        ))}
        <td rowSpan={2} className="whitespace-nowrap border-b border-l border-line px-3 text-right align-middle">
          <b className="font-display text-xl tabular-nums text-accent">{total} d</b>
          <div className="text-[11px] text-muted">≈ {meses(total)} meses</div>
        </td>
      </tr>
      <tr>
        {tipo.blocos.map((b, k) => (
          <td key={k} colSpan={b.fases.length} className={`border-b border-l border-line px-1 pb-2 pt-1 text-center ${b.fases.length > 1 ? 'bg-accent-soft' : ''}`}>
            <span className="flex justify-center gap-1">
              {b.fases.length > 1 && (
                <button type="button" onClick={() => separar(k)} className="rounded px-1.5 text-[10.5px] text-muted hover:bg-surface hover:text-accent">
                  separar
                </button>
              )}
              {k < tipo.blocos.length - 1 && (
                <button type="button" onClick={() => juntar(k)} title="Correr junto com a fase seguinte" className="rounded px-1.5 text-[10.5px] text-muted hover:bg-surface hover:text-accent">
                  ⇥ juntar
                </button>
              )}
            </span>
          </td>
        ))}
      </tr>
    </>
  );
}
