/**
 * Dados de exemplo (DEMO=1) para testar a tela sem token do ClickUp.
 * Formato igual ao que a API do ClickUp devolve.
 */
import type { CUTarefa, CUTempoStatus } from './clickup';

const DIA = 864e5;
const agora = Date.now();
const criado = String(agora - 2 * DIA);
const inicio = String(Date.UTC(2026, 0, 14, 12));
const vencimento = String(Date.UTC(2026, 11, 22, 12));

const FAROL = ['No Prazo', 'Atenção', 'Atrasado'];
const CORES_FAROL = ['#10ff00', '#ffc53d', '#ff0000'];

const TIPOS = ['Ampliação de Portfólio', 'Ampliação de Família', 'Nova Família'];

const FASES_ROTULO = ['Aguardando amostra', 'Teste / Validação', 'Em trânsito amostra c/ arte', 'Marketing'];

function tarefa(id: string, nome: string, status: string, cor: string, farol?: number, tipo?: number, dispensadas: string[] = []): CUTarefa {
  return {
    id,
    name: nome,
    url: `https://app.clickup.com/t/${id}`,
    status: { status, color: cor, type: 'custom' },
    date_created: criado,
    date_updated: String(agora),
    start_date: inicio,
    due_date: vencimento,
    assignees: [],
    custom_fields: [
      { id: 'pvl', name: 'CÓDIGO PVL', type: 'short_text', value: 'PVL-' + id.slice(-3).toUpperCase() },
      {
        id: 'fam',
        name: 'FAMÍLIA',
        type: 'drop_down',
        value: 0,
        type_config: { options: [{ id: 'f', name: '00 - Família de exemplo', orderindex: 0 }] },
      },
      {
        id: 'onda',
        name: 'ONDA - LANÇAMENTO',
        type: 'drop_down',
        value: 0,
        type_config: { options: [{ id: 'o1', name: 'ONDA 1', orderindex: 0 }] },
      },
      { id: 'qtd', name: 'QUANTIDADE SUBITENS', type: 'number', value: '3' },
      {
        id: 'farol',
        name: 'Status do Projeto',
        type: 'drop_down',
        value: farol ?? null,
        type_config: { options: FAROL.map((name, orderindex) => ({ id: 'f' + orderindex, name, orderindex, color: CORES_FAROL[orderindex] })) },
      },
      {
        id: 'tipo',
        name: 'Tipo de Projeto',
        type: 'drop_down',
        value: tipo ?? null,
        type_config: { options: TIPOS.map((name, orderindex) => ({ id: 't' + orderindex, name, orderindex })) },
      },
      { id: 'resp', name: 'Solicitante do Teste', type: 'short_text', value: ['Camila Rezende', 'Matheus Leite', 'João Gabriel'][(tipo ?? 0) % 3] },
      {
        id: 'disp',
        name: 'FASES DISPENSADAS',
        type: 'labels',
        value: dispensadas.length ? dispensadas.map((n) => 'l' + FASES_ROTULO.indexOf(n)) : null,
        type_config: { options: FASES_ROTULO.map((label, orderindex) => ({ id: 'l' + orderindex, name: label, label, orderindex })) },
      },
      { id: 'pp', name: 'PRÓXIMO PASSO', type: 'text', value: farol === 2 ? 'Fechar fornecedor até a próxima terça' : null },
    ],
  };
}

export const TAREFAS_DEMO: CUTarefa[] = [
  tarefa('demo001', 'EXEMPLO — PROJETO EM FIRST ORDER', 'first order', '#8a1e91', 1, 1),
  tarefa('demo002', 'EXEMPLO — PROJETO EM SOURCING', 'sourcing', '#e39a7e', 2, 2),
  tarefa('demo003', 'EXEMPLO — PROJETO AVANÇADO', 'marketing', '#9e837a', 0, 0),
  tarefa('demo004', 'EXEMPLO — PROJETO NO BACKLOG', 'backlog', '#87909e'),
  tarefa('demo005', 'EXEMPLO — REVISÃO (sem amostra c/ arte e sem marketing)', 'envio primeiro lote', '#c3102f', 0, 1, ['Em trânsito amostra c/ arte', 'Marketing']),
  tarefa('demo006', 'EXEMPLO — PULOU FASE SEM MARCAR', 'marketing', '#9e837a', 1, 1),
];

const h = (status: string, diasAtras: number) => ({
  status,
  color: '#999',
  type: 'custom',
  orderindex: 0,
  total_time: { by_minute: 0, since: String(agora - diasAtras * DIA) },
});

export const TEMPO_DEMO: Record<string, CUTempoStatus> = {
  demo001: { status_history: [{ ...h('first order', 2), total_time: { by_minute: 0, since: criado } }] },
  demo002: { status_history: [h('escopo / briefing', 45), h('sourcing', 30)] },
  demo003: { status_history: [h('first order', 50), h('envio amostra c/ arte', 25), h('marketing', 6)] },
  demo005: { status_history: [h('first order', 12), h('envio primeiro lote', 1)] },
  demo006: { status_history: [h('first order', 12), h('marketing', 1)] },
  demo004: { status_history: [{ ...h('backlog', 2), total_time: { by_minute: 0, since: criado } }] },
};
