/**
 * Follow-up no detalhe do projeto: o comentário digitado vai para o card do ClickUp no padrão
 *   ♦️DATA: dd/mm/aaaa
 *   ♦️Comentário: texto
 * Não altera nenhum campo do card. Mostra os follow-ups anteriores (lidos dos comentários do card).
 */
import { useEffect, useState } from 'react';
import type { Followup, Projeto } from '@shared/types';
import { api } from '../lib/api';
import { Botao, Rotulo } from './ui';

const MAX_CARACTERES = 4000;
const VISIVEIS = 3;
/** Rascunho por projeto: fechar o painel sem querer não perde o texto (enquanto a página estiver aberta). */
const rascunhos = new Map<string, string>();

export function FollowupComentario({ p, editavel = true }: { p: Projeto; editavel?: boolean }) {
  const [hist, setHist] = useState<Followup[] | null>(null);
  const [todos, setTodos] = useState(false);
  const [aberto, setAberto] = useState(() => rascunhos.has(p.id));
  const [texto, setTexto] = useState(() => rascunhos.get(p.id) ?? '');
  const [etapa, setEtapa] = useState<'form' | 'confirmar'>('form');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  const carregarHist = () => api.followups(p.id).then(setHist).catch(() => setHist([]));
  useEffect(() => {
    carregarHist();
  }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mudarTexto = (v: string) => {
    setTexto(v);
    if (v.trim()) rascunhos.set(p.id, v);
    else rascunhos.delete(p.id);
  };
  const hoje = new Date().toLocaleDateString('pt-BR');
  const limpo = texto.trim();
  const valido = limpo.length >= 2 && limpo.length <= MAX_CARACTERES;

  function abrir() {
    setAberto(true);
    setEtapa('form');
    setMsg(null);
  }

  async function enviar() {
    setEnviando(true);
    setMsg(null);
    try {
      await api.registrarFollowup(p.id, limpo);
      setMsg({ ok: true, txt: `Follow-up de ${hoje} registrado como comentário no card do ClickUp.` });
      mudarTexto('');
      setAberto(false);
      setEtapa('form');
      carregarHist();
    } catch (e) {
      setMsg({ ok: false, txt: (e as Error).message });
      setEtapa('form');
    } finally {
      setEnviando(false);
    }
  }

  const lista = hist ? (todos ? hist : hist.slice(0, VISIVEIS)) : [];
  // modo leitura: só o histórico (e nada, se o card não tiver follow-ups)
  if (!editavel && !lista.length) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Rotulo>Comentários de follow-up</Rotulo>
        {hist && hist.length > 0 && (
          <span className="rounded-full bg-sunk px-2 py-px text-[11px] font-semibold text-muted">
            {hist.length} registrado{hist.length > 1 ? 's' : ''}
          </span>
        )}
        {editavel && !aberto && (
          <span className="ml-auto">
            <Botao onClick={abrir}>Acrescentar comentário</Botao>
          </span>
        )}
      </div>

      {editavel && aberto && (
        <div className="flex flex-col gap-2 rounded-md bg-sunk px-3 py-2.5">
          {etapa === 'form' ? (
            <>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Comentário do follow-up de hoje ({hoje})
                <textarea
                  autoFocus
                  className="min-h-24 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                  value={texto}
                  maxLength={MAX_CARACTERES}
                  onChange={(e) => mudarTexto(e.target.value)}
                  onKeyDown={(e) => {
                    // Esc com texto digitado não fecha o painel; Ctrl+Enter vai para a revisão
                    if (e.key === 'Escape' && texto.trim()) e.stopPropagation();
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && valido) setEtapa('confirmar');
                  }}
                  placeholder="Ex.: Fornecedor enviou nova cotação; amostra prevista para a próxima semana."
                />
              </label>
              <small className="text-[11px] text-muted">
                Vai para o card como comentário, com a data de hoje. Não altera nenhum campo. Ctrl + Enter para revisar.
                {limpo.length > MAX_CARACTERES - 500 && ` (${limpo.length}/${MAX_CARACTERES})`}
              </small>
              <div className="flex gap-2">
                <Botao primario disabled={!valido} onClick={() => setEtapa('confirmar')}>
                  Revisar
                </Botao>
                <Botao onClick={() => setAberto(false)}>Cancelar</Botao>
              </div>
            </>
          ) : (
            <>
              <span className="text-[13px]">Confirma o envio? Este comentário será criado no card:</span>
              <pre className="m-0 whitespace-pre-wrap rounded border border-line bg-surface px-3 py-2 font-sans text-[13px] leading-relaxed">
                {`♦️DATA: ${hoje}\n♦️Comentário: ${limpo}`}
              </pre>
              <div className="flex gap-2">
                <Botao primario disabled={enviando} onClick={enviar}>
                  {enviando ? 'Enviando…' : 'Confirmar e enviar ao ClickUp'}
                </Botao>
                <Botao onClick={() => setEtapa('form')}>Voltar</Botao>
              </div>
            </>
          )}
        </div>
      )}
      {msg && <small className={`text-xs ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.txt}</small>}

      {lista.length > 0 && (
        <div className="flex flex-col gap-1">
          <Rotulo>Follow-ups anteriores</Rotulo>
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {lista.map((h, i) => (
              <li key={`${h.em ?? h.data}-${i}`} className="border-l-2 border-accent pl-2 text-[12.5px]">
                <b className="tabular-nums">{h.data}</b>
                <span className="block whitespace-pre-wrap">{h.comentario}</span>
              </li>
            ))}
          </ol>
          {hist && hist.length > VISIVEIS && (
            <button type="button" className="self-start text-xs font-semibold text-accent hover:underline" onClick={() => setTodos(!todos)}>
              {todos ? 'Ver menos' : `Ver todos (${hist.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
