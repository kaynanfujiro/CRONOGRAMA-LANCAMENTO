/**
 * Farol automático (aba Parâmetros): regras editáveis, prévia e atualização do ClickUp.
 */
import { useEffect, useState } from 'react';
import type { Modelo } from '@shared/types';
import { regrasFarol } from '@shared/modelo-padrao';
import type { RelatorioFarol } from '@shared/farol-auto';
import { api } from '../lib/api';
import { Botao, Pill, Rotulo } from './ui';

const TOM = { Atrasado: 'bad', Atenção: 'warn', 'No Prazo': 'ok' } as const;

export function FarolAutoPainel({ modelo, alterar }: { modelo: Modelo; alterar: (m: Modelo) => void }) {
  const regras = regrasFarol(modelo);
  const set = (p: Partial<typeof regras>) => alterar({ ...modelo, farolAuto: { ...regras, ...p } });
  const [rel, setRel] = useState<RelatorioFarol | null>(null);
  const [rodando, setRodando] = useState<'' | 'previa' | 'gravar'>('');
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    api.farol().then(setRel).catch(() => {});
  }, []);

  async function rodar(simular: boolean) {
    setRodando(simular ? 'previa' : 'gravar');
    setErro(null);
    setConfirmar(false);
    try {
      setRel(await api.sincronizarFarol(simular));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setRodando('');
    }
  }

  const inp = 'w-14 rounded border border-line bg-bg px-1.5 py-1 text-center font-mono text-[13px] font-semibold';

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">Farol automático</h2>
          <p className="m-0 max-w-[80ch] text-[13px] text-muted">
            Calcula o <b className="text-ink">Status do Projeto</b> a partir do cronograma e grava no ClickUp — sem preencher à mão. Só mexe em
            projetos em andamento (backlog, concluídos e cancelados ficam como estão) e só grava quando o valor muda.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-[13px] font-semibold">
          <input type="checkbox" checked={regras.ativo} onChange={(e) => set({ ativo: e.target.checked })} />
          {regras.ativo ? 'Ligado — grava no ClickUp' : 'Desligado — só prévia'}
        </label>
      </div>

      <ul className="m-0 grid list-none gap-2 p-0 text-[13px] md:grid-cols-3">
        <li className="rounded-md border-l-4 border-bad bg-sunk px-3 py-2">
          <b className="text-bad">Atrasado</b> — o real já saiu do esperado: a fase atual passou do prazo, ou a conclusão projetada ficou mais de{' '}
          <input type="number" min={0} className={inp} value={regras.toleranciaDias} onChange={(e) => set({ toleranciaDias: Math.max(0, +e.target.value || 0) })} /> d
          depois da planejada.
        </li>
        <li className="rounded-md border-l-4 border-warn bg-sunk px-3 py-2">
          <b className="text-warn">Atenção</b> — risco de atraso: ainda no plano, mas a fase atual já usou{' '}
          <input type="number" min={1} max={100} className={inp} value={regras.atencaoPct} onChange={(e) => set({ atencaoPct: Math.min(100, Math.max(1, +e.target.value || 80)) })} /> %
          do prazo dela.
        </li>
        <li className="rounded-md border-l-4 border-good bg-sunk px-3 py-2">
          <b className="text-good">No Prazo</b> — dentro do planejado e com folga na fase atual.
        </li>
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Botao onClick={() => rodar(true)} disabled={!!rodando}>
          {rodando === 'previa' ? 'Calculando…' : 'Ver prévia'}
        </Botao>
        {regras.ativo && !confirmar && (
          <Botao primario onClick={() => setConfirmar(true)} disabled={!!rodando}>
            Atualizar ClickUp agora
          </Botao>
        )}
        {confirmar && (
          <>
            <span className="text-[13px]">Gravar o farol calculado em todos os cards que mudaram?</span>
            <Botao primario onClick={() => rodar(false)} disabled={!!rodando}>
              {rodando === 'gravar' ? 'Gravando…' : 'Confirmar'}
            </Botao>
            <Botao onClick={() => setConfirmar(false)}>Cancelar</Botao>
          </>
        )}
        <span className="text-xs text-muted">
          Com o farol ligado, o servidor também atualiza sozinho a cada 30 min enquanto estiver rodando (ou via <code>npm run farol</code>).
        </span>
      </div>
      {erro && <p className="m-0 text-[13px] text-bad">{erro}</p>}

      {rel && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <Rotulo>{rel.simulado ? 'Prévia' : 'Última atualização'}</Rotulo>
            <span className="text-muted">{new Date(rel.em).toLocaleString('pt-BR')}</span>·
            <span>
              {rel.avaliados} avaliados · <b>{rel.simulado ? `${rel.mudancas.length} mudariam` : `${rel.alterados} alterados`}</b> · {rel.semMudanca} já corretos
              · {rel.ignorados} fora (backlog/concluído/cancelado)
            </span>
          </div>
          {rel.aviso && <p className="m-0 text-xs text-warn">{rel.aviso}</p>}
          {rel.mudancas.length > 0 && (
            <div className="max-h-80 overflow-auto rounded-md border border-line">
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="sticky top-0 bg-sunk text-left text-[10.5px] uppercase tracking-wider text-muted">
                  <tr>
                    {['Projeto', 'Hoje no ClickUp', 'Calculado', 'Por quê'].map((h) => (
                      <th key={h} className="border-b border-line px-2 py-1.5 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rel.mudancas.map((m) => (
                    <tr key={m.id}>
                      <td className="border-b border-line px-2 py-1.5">{m.nome}</td>
                      <td className="border-b border-line px-2 py-1.5 text-muted">{m.de ?? '—'}</td>
                      <td className="border-b border-line px-2 py-1.5">
                        <Pill saude={TOM[m.para]}>{m.para}</Pill>
                      </td>
                      <td className="border-b border-line px-2 py-1.5 text-muted">
                        {m.motivo}
                        {m.erro && <span className="block text-bad">erro: {m.erro}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
