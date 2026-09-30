/**
 * Cliente mínimo da API v2 do ClickUp.
 * Documentação: https://clickup.com/api
 */
import { config } from './config';

const BASE = 'https://api.clickup.com/api/v2';

export class ErroClickUp extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const resp = await fetch(BASE + caminho, {
    ...init,
    headers: {
      Authorization: config.token,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => '');
    const dica =
      resp.status === 401
        ? 'Token do ClickUp inválido ou sem acesso à lista.'
        : resp.status === 429
          ? 'Limite de requisições do ClickUp atingido; tente em 1 minuto.'
          : `ClickUp respondeu ${resp.status}.`;
    throw new ErroClickUp(resp.status, `${dica} ${corpo.slice(0, 300)}`);
  }
  return (await resp.json()) as T;
}

/* ---------- formatos da API (só o que usamos) ---------- */

export interface CUOpcao {
  id: string;
  name: string;
  /** campos do tipo "labels" usam `label` no lugar de `name` */
  label?: string;
  orderindex: number;
  color?: string;
}
export interface CUCampo {
  id: string;
  name: string;
  type: string;
  type_config?: { options?: CUOpcao[] };
  value?: unknown;
}
export interface CUTarefa {
  id: string;
  name: string;
  url: string;
  status: { status: string; color: string; type: string };
  date_created: string;
  date_updated: string;
  start_date: string | null;
  due_date: string | null;
  assignees: { username?: string; email?: string }[];
  custom_fields: CUCampo[];
}
export interface CUTempoStatus {
  current_status?: { status: string; color: string; total_time: { by_minute: number; since: string } };
  status_history?: { status: string; color: string; type: string; orderindex: number; total_time: { by_minute: number; since: string } }[];
}

/* ---------- chamadas ---------- */

/** Todas as tarefas da lista (paginado de 100 em 100). */
export async function listarTarefas(listId: string): Promise<CUTarefa[]> {
  const todas: CUTarefa[] = [];
  for (let page = 0; page < 50; page++) {
    const r = await chamar<{ tasks: CUTarefa[]; last_page?: boolean }>(
      `/list/${listId}/task?page=${page}&include_closed=true&subtasks=false&archived=false`,
    );
    todas.push(...r.tasks);
    if (r.last_page !== false || r.tasks.length === 0) break;
  }
  return todas;
}

/** Histórico de status (tempo em status) de até 100 tarefas por chamada. */
export async function tempoEmStatus(ids: string[]): Promise<Record<string, CUTempoStatus>> {
  const saida: Record<string, CUTempoStatus> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const qs = lote.map((id) => `task_ids=${encodeURIComponent(id)}`).join('&');
    Object.assign(saida, await chamar<Record<string, CUTempoStatus>>(`/task/bulk_time_in_status/task_ids?${qs}`));
  }
  return saida;
}

/** Status configurados na lista (nome, cor e ordem). */
export async function statusDaLista(listId: string) {
  const r = await chamar<{ statuses: { status: string; color: string; type: string; orderindex: number }[] }>(
    `/list/${listId}`,
  );
  return r.statuses.sort((a, b) => a.orderindex - b.orderindex);
}

/** Muda o status (fase) de uma tarefa. */
export async function mudarStatus(taskId: string, status: string) {
  return chamar<CUTarefa>(`/task/${taskId}`, { method: 'PUT', body: JSON.stringify({ status }) });
}

/** Grava o valor de um campo personalizado (lista suspensa: id da opção). */
export async function definirCampo(taskId: string, fieldId: string, value: unknown) {
  return chamar<unknown>(`/task/${taskId}/field/${fieldId}`, { method: 'POST', body: JSON.stringify({ value }) });
}

/** Uma tarefa (com campos personalizados). */
export async function obterTarefa(taskId: string) {
  return chamar<CUTarefa>(`/task/${taskId}`);
}

/** Cria um comentário no card. */
export async function comentar(taskId: string, texto: string) {
  return chamar<{ id: string }>(`/task/${taskId}/comment`, {
    method: 'POST',
    body: JSON.stringify({ comment_text: texto, notify_all: false }),
  });
}

export interface CUComentario {
  id: string;
  comment_text: string;
  date: string;
  user?: { username?: string; email?: string };
}
/** Comentários do card (mais recentes primeiro). */
export async function listarComentarios(taskId: string) {
  const r = await chamar<{ comments: CUComentario[] }>(`/task/${taskId}/comment`);
  return r.comments;
}
