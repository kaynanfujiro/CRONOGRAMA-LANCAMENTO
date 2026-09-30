/**
 * Reprogramação da onda de lançamento.
 * Muda ONDA/ANO no card e deixa a evidência como comentário padronizado:
 *
 *   🔁 REPROGRAMAÇÃO DE LANÇAMENTO
 *   🔹Data: 30/09/2026
 *   🔹Onda inicial: ONDA 1 - 2027
 *   🔹Nova onda: ONDA 3 - 2027
 *   🔹Categoria: Atraso em Sourcing
 *   🔹Motivo: ...
 *
 * Se existirem na lista, também preenche "ONDA ORIGINAL" (só na 1ª vez) e soma 1 em "REPROGRAMAÇÕES".
 */
import type { OpcoesOnda, PedidoReprogramacao, Reprogramacao } from '../../shared/types';
import { MOTIVOS_REPROGRAMACAO } from '../../shared/types';
import { normalizar } from '../../shared/modelo-padrao';
import { comentar, definirCampo, listarComentarios, obterTarefa, type CUCampo, type CUTarefa } from './clickup';
import { CAMPOS, campo, valorTexto } from './normalizar';

const TITULO = '🔁 REPROGRAMAÇÃO DE LANÇAMENTO';
const rotuloOnda = (onda: string | null, ano: string | null) => (onda ? `${onda}${ano ? ' - ' + ano : ''}` : '—');
const nomesOpcoes = (f?: CUCampo) => (f?.type_config?.options ?? []).map((o) => o.name);
const opcao = (f: CUCampo, nome: string) => f.type_config?.options?.find((o) => normalizar(o.name) === normalizar(nome));

export function opcoesOnda(t: CUTarefa | undefined): OpcoesOnda {
  return {
    ondas: nomesOpcoes(t && campo(t, CAMPOS.onda)),
    anos: nomesOpcoes(t && campo(t, CAMPOS.ano)),
    temOndaOriginal: !!(t && campo(t, CAMPOS.ondaOriginal)),
    temContador: !!(t && campo(t, CAMPOS.reprogramacoes)),
  };
}

export async function reprogramar(taskId: string, pedido: PedidoReprogramacao) {
  const motivo = String(pedido.motivo ?? '').trim();
  const categoria = String(pedido.categoria ?? '').trim();
  if (motivo.length < 5) throw new ErroPedido('Descreva o motivo da reprogramação (é a evidência no card).');
  if (!(MOTIVOS_REPROGRAMACAO as readonly string[]).includes(categoria)) throw new ErroPedido('Escolha a categoria do motivo.');

  // sempre relê o card: compara com o valor atual do ClickUp, não com o cache da tela
  const t = await obterTarefa(taskId);
  const fOnda = campo(t, CAMPOS.onda);
  const fAno = campo(t, CAMPOS.ano);
  if (!fOnda || !fAno) throw new ErroPedido('Campos "ONDA - LANÇAMENTO" e "ANO DE LANÇAMENTO" não encontrados no card.');
  const novaOnda = opcao(fOnda, pedido.onda);
  const novoAno = opcao(fAno, pedido.ano);
  if (!novaOnda || !novoAno) throw new ErroPedido('Onda ou ano inválido.');

  const ondaAtual = valorTexto(fOnda);
  const anoAtual = valorTexto(fAno);
  const de = rotuloOnda(ondaAtual, anoAtual);
  const para = rotuloOnda(novaOnda.name, novoAno.name);
  if (de === para) throw new ErroPedido('A onda escolhida é a mesma de hoje.');

  // 1) campos
  if (normalizar(ondaAtual) !== normalizar(novaOnda.name)) await definirCampo(t.id, fOnda.id, novaOnda.id);
  if (normalizar(anoAtual) !== normalizar(novoAno.name)) await definirCampo(t.id, fAno.id, novoAno.id);
  const fOriginal = campo(t, CAMPOS.ondaOriginal);
  if (fOriginal && !valorTexto(fOriginal) && ondaAtual) await definirCampo(t.id, fOriginal.id, de);
  const fCont = campo(t, CAMPOS.reprogramacoes);
  // conta pelo maior entre o campo e os comentários de reprogramação já feitos (não perde conta se o campo falhar)
  const jaFeitas = await listarComentarios(t.id)
    .then((cs) => cs.filter((c) => c.comment_text?.includes('REPROGRAMAÇÃO DE LANÇAMENTO')).length)
    .catch(() => 0);
  const vezes = Math.max(Number(fCont?.value) || 0, jaFeitas) + 1;
  if (fCont) await definirCampo(t.id, fCont.id, vezes);

  // 2) evidência no card
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const texto = [
    TITULO,
    `🔹Data: ${hoje}`,
    `🔹Onda inicial: ${de}`,
    `🔹Nova onda: ${para}`,
    `🔹Categoria: ${categoria}`,
    `🔹Motivo: ${motivo}`,
    fCont ? `🔹Reprogramação nº: ${vezes}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  await comentar(t.id, texto);
  return { de, para, vezes, comentario: texto };
}

/** Lê o histórico de reprogramações a partir dos comentários do card. */
export async function historico(taskId: string): Promise<Reprogramacao[]> {
  const coms = await listarComentarios(taskId);
  const linha = (txt: string, rot: string) =>
    txt
      .split('\n')
      .find((l) => normalizar(l).startsWith(normalizar(rot)))
      ?.replace(/^[^:]*:\s*/, '')
      .trim() ?? '';
  return coms
    .filter((c) => c.comment_text?.includes('REPROGRAMAÇÃO DE LANÇAMENTO'))
    .map((c) => ({
      data: linha(c.comment_text, 'Data') || new Date(Number(c.date)).toLocaleDateString('pt-BR'),
      de: linha(c.comment_text, 'Onda inicial'),
      para: linha(c.comment_text, 'Nova onda'),
      categoria: linha(c.comment_text, 'Categoria'),
      motivo: linha(c.comment_text, 'Motivo'),
      por: c.user?.username ?? c.user?.email ?? null,
    }));
}

export class ErroPedido extends Error {}
