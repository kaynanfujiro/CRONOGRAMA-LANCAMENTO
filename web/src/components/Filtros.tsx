import type { Modelo, Projeto } from '@shared/types';
import { FAROIS } from '../lib/farol';

export interface EstadoFiltros {
  busca: string;
  analista: string;
  situacao: string;
  onda: string;
  fase: string;
  farol: string;
  tipo: string;
  ordem: 'farol' | 'lanc' | 'desvio' | 'nome';
  zoom: number;
}
export const FILTROS_INICIAIS: EstadoFiltros = { busca: '', analista: '', situacao: '', onda: '', fase: '', farol: '', tipo: '', ordem: 'farol', zoom: 4 };

const unicos = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
const sel = 'min-w-[130px] rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] font-normal normal-case tracking-normal text-ink';
const lbl = 'flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted';

export function Filtros({
  f,
  set,
  projetos,
  modelo,
  cronograma = true,
}: {
  f: EstadoFiltros;
  set: (f: EstadoFiltros) => void;
  projetos: Projeto[];
  modelo: Modelo;
  /** false = esconde "Ordenar por" e "Escala" (tela de dashboards) */
  cronograma?: boolean;
}) {
  const up = (p: Partial<EstadoFiltros>) => set({ ...f, ...p });
  const analistas = unicos(projetos.flatMap((p) => (p.analistas.length ? p.analistas : ['Sem responsável'])));
  return (
    <section className="flex flex-wrap items-end gap-2.5" aria-label="Filtros">
      <label className={lbl}>
        Buscar
        <input className={sel} type="search" placeholder="Projeto ou PVL" value={f.busca} onChange={(e) => up({ busca: e.target.value })} />
      </label>
      <label className={lbl}>
        Responsável
        <select className={sel} value={f.analista} onChange={(e) => up({ analista: e.target.value })}>
          <option value="">Todos</option>
          {analistas.map((a) => <option key={a}>{a}</option>)}
        </select>
      </label>
      <label className={lbl}>
        Farol
        <select className={sel} value={f.farol} onChange={(e) => up({ farol: e.target.value })}>
          <option value="">Todos</option>
          {FAROIS.map((x) => <option key={x}>{x}</option>)}
        </select>
      </label>
      <label className={lbl}>
        Situação
        <select className={sel} value={f.situacao} onChange={(e) => up({ situacao: e.target.value })}>
          <option value="">Todas</option>
          {unicos(projetos.map((p) => p.situacao)).map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label className={lbl}>
        Onda
        <select className={sel} value={f.onda} onChange={(e) => up({ onda: e.target.value })}>
          <option value="">Todas</option>
          {unicos(projetos.map((p) => p.onda)).map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label className={lbl}>
        Tipo de projeto
        <select className={sel} value={f.tipo} onChange={(e) => up({ tipo: e.target.value })}>
          <option value="">Todos</option>
          {modelo.tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </label>
      <label className={lbl}>
        Fase atual
        <select className={sel} value={f.fase} onChange={(e) => up({ fase: e.target.value })}>
          <option value="">Todas</option>
          {modelo.fases.map((x) => <option key={x.nome}>{x.nome}</option>)}
        </select>
      </label>
      {cronograma && (<>
      <label className={lbl}>
        Ordenar por
        <select className={sel} value={f.ordem} onChange={(e) => up({ ordem: e.target.value as EstadoFiltros['ordem'] })}>
          <option value="farol">Farol (atrasados primeiro)</option>
          <option value="desvio">Maior desvio</option>
          <option value="lanc">Lançamento planejado</option>
          <option value="nome">Nome</option>
        </select>
      </label>
      <div className={lbl}>
        Escala
        <span className="inline-flex overflow-hidden rounded-md border border-line bg-surface" role="group">
          {[
            ['Semanas', 4],
            ['Meses', 1.6],
          ].map(([t, z]) => (
            <button
              key={t}
              type="button"
              aria-pressed={f.zoom === z}
              onClick={() => up({ zoom: z as number })}
              className={`px-2.5 py-1.5 text-[13px] normal-case tracking-normal ${f.zoom === z ? 'bg-accent text-white' : 'text-ink hover:bg-sunk'}`}
            >
              {t}
            </button>
          ))}
        </span>
      </div>
      </>)}
    </section>
  );
}
