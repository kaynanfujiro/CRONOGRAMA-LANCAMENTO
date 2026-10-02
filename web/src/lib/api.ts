import type { Followup, Modelo, OpcoesOnda, PedidoReprogramacao, Reprogramacao, RespostaProjetos, StatusLista } from '@shared/types';
import type { RelatorioFarol } from '@shared/farol-auto';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((corpo as { erro?: string }).erro ?? `Erro ${r.status}`);
  return corpo as T;
}

/** Acesso: editor = pode alterar; protegido = o servidor exige senha para alterar. */
export interface Sessao { editor: boolean; protegido: boolean; senhaConfigurada: boolean }

export interface Saude { ok: boolean; erros: string[]; demo: boolean; arquivoEnv: string; testeClickUp: string }

export const api = {
  saude: () => req<Saude>('/api/saude'),
  sessao: () => req<Sessao>('/api/sessao'),
  entrar: (senha: string) => req<{ editor: boolean }>('/api/sessao', { method: 'POST', body: JSON.stringify({ senha }) }),
  sair: () => req<{ editor: boolean }>('/api/sessao', { method: 'DELETE' }),
  projetos: (atualizar = false) => req<RespostaProjetos>(`/api/projetos${atualizar ? '?atualizar=1' : ''}`),
  status: () => req<StatusLista[]>('/api/status'),
  modelo: () => req<Modelo>('/api/modelo'),
  salvarModelo: (m: Modelo) => req<Modelo>('/api/modelo', { method: 'PUT', body: JSON.stringify(m) }),
  ondas: () => req<OpcoesOnda>('/api/ondas'),
  reprogramar: (id: string, p: PedidoReprogramacao) =>
    req<{ de: string; para: string; vezes: number }>(`/api/projetos/${id}/onda`, { method: 'POST', body: JSON.stringify(p) }),
  reprogramacoes: (id: string) => req<Reprogramacao[]>(`/api/projetos/${id}/reprogramacoes`),
  followups: (id: string) => req<Followup[]>(`/api/projetos/${id}/followups`),
  registrarFollowup: (id: string, comentario: string) =>
    req<{ comentario: string }>(`/api/projetos/${id}/followup`, { method: 'POST', body: JSON.stringify({ comentario }) }),
  farol: () => req<RelatorioFarol | null>('/api/farol'),
  sincronizarFarol: (simular: boolean) =>
    req<RelatorioFarol & { aviso?: string }>(`/api/farol/sincronizar${simular ? '?simular=1' : ''}`, { method: 'POST' }),
  mudarStatus: (id: string, status: string) =>
    req<{ ok: true }>(`/api/projetos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};
