/**
 * Follow-up do projeto: comentário padronizado no card do ClickUp. Não altera nenhum campo.
 *
 *   ♦️DATA: 02/10/2026
 *   ♦️Comentário: texto digitado no follow-up
 */
import type { Followup } from '../../shared/types';
import { comentar, listarComentarios } from './clickup';
import { ErroPedido } from './reprogramacao';

const MAX_CARACTERES = 4000;
const RE_DATA = /♦️?\s*DATA\s*:\s*(.*)/i;
const RE_COMENTARIO = /♦️?\s*COMENT[AÁaá]RIO\s*:\s*([\s\S]*)$/i;

/** Texto exato que vai para o card (a data é a de hoje, no fuso de Brasília). */
export function textoFollowup(comentario: string, quando = new Date()) {
  const dia = quando.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `♦️DATA: ${dia}\n♦️Comentário: ${comentario}`;
}

export async function registrarFollowup(taskId: string, comentario: unknown) {
  const txt = String(comentario ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (txt.length < 2) throw new ErroPedido('Escreva o comentário do follow-up.');
  if (txt.length > MAX_CARACTERES) throw new ErroPedido(`Comentário muito longo (máximo de ${MAX_CARACTERES} caracteres).`);
  const texto = textoFollowup(txt);
  await comentar(taskId, texto);
  return { comentario: texto };
}

/** Follow-ups do card, do mais recente para o mais antigo (o ClickUp devolve os últimos 25 comentários). */
export async function followups(taskId: string): Promise<Followup[]> {
  const comentarios = await listarComentarios(taskId);
  return comentarios.flatMap((c) => {
    const texto = c.comment_text ?? '';
    const data = texto.match(RE_DATA);
    const corpo = texto.match(RE_COMENTARIO);
    if (!data || !corpo) return [];
    return [
      {
        data: data[1].trim(),
        comentario: corpo[1].trim(),
        por: c.user?.username ?? c.user?.email ?? null,
        em: c.date ? new Date(Number(c.date)).toISOString() : null,
      },
    ];
  });
}
