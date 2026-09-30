import type { Modelo } from '@shared/types';

export function Legenda({ modelo }: { modelo: Modelo }) {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5 text-ink">
        <span className="inline-block h-[5px] w-6 rounded-sm bg-[#50575d] opacity-55" />
        Planejado
      </span>
      <span className="inline-flex items-center gap-1.5 text-ink">
        <span className="inline-block h-3 w-6 rounded-sm bg-[#50575d]" />
        Realizado
      </span>
      <span className="inline-flex items-center gap-1.5 text-ink">
        <span className="barra-proj inline-block h-3 w-6 rounded-sm" style={{ ['--c' as string]: '#50575d' }} />
        Projeção (a partir de hoje)
      </span>
      {modelo.fases.map((f) => (
        <span key={f.nome} className="inline-flex items-center gap-1.5">
          <i className="inline-block h-3 w-3 rounded-sm" style={{ background: f.cor }} />
          {f.nome}
        </span>
      ))}
    </div>
  );
}
