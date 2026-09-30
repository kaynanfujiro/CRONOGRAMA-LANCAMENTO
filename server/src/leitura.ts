/** Lê a lista do ClickUp (ou a demo) e converte em projetos. */
import type { Modelo, Projeto } from '../../shared/types';
import { config } from './config';
import { listarTarefas, tempoEmStatus, type CUTarefa, type CUTempoStatus } from './clickup';
import { paraProjeto } from './normalizar';
import { TAREFAS_DEMO, TEMPO_DEMO } from './demo';

export async function lerClickUp(modelo: Modelo): Promise<{ tarefas: CUTarefa[]; projetos: Projeto[] }> {
  const tarefas = config.demo ? structuredClone(TAREFAS_DEMO) : await listarTarefas(config.listId);
  let tempos: Record<string, CUTempoStatus> = {};
  if (config.demo) tempos = TEMPO_DEMO;
  else if (tarefas.length) {
    try {
      tempos = await tempoEmStatus(tarefas.map((t) => t.id));
    } catch (e) {
      // sem histórico o cronograma ainda funciona (só não mostra datas reais)
      console.warn('[clickup] não foi possível ler o tempo em status:', (e as Error).message);
      console.warn('          Confira se o ClickApp "Total time in Status" está ativo no espaço.');
    }
  }
  console.log(`[clickup] ${tarefas.length} projetos lidos da lista ${config.listId}`);
  return { tarefas, projetos: tarefas.map((t) => paraProjeto(t, tempos[t.id], modelo)) };
}
