/**
 * Onda de lançamento no detalhe do projeto: mostra a onda, o histórico de reprogramações
 * (lido dos comentários do card) e permite reprogramar com motivo obrigatório.
 */
import { useEffect, useState } from 'react';
import { MOTIVOS_REPROGRAMACAO, type OpcoesOnda, type Projeto, type Reprogramacao } from '@shared/types';
import { api } from '../lib/api';
import { Botao, Rotulo } from './ui';

const rotulo = (onda: string | null, ano: string | null) => (onda ? `${onda}${ano ? ' - ' + ano : ''}` : '—');
const campo = 'rounded-md border border-line bg-surface px-2 py-1.5 text-sm';

export function ReprogramarOnda({ p, aoMudar, editavel = true }: { p: Projeto; aoMudar: () => void; editavel?: boolean }) {
  const [hist, setHist] = useState<Reprogramacao[] | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesOnda | null>(null);
  const [aberto, setAberto] = useState(false);
  const [onda, setOnda] = useState(p.onda ?? '');
  const [ano, setAno] = useState(p.ano ?? '');
  const [categoria, setCategoria] = useState('');
  const [motivo, setMotivo] = useState('');
  const [etapa, setEtapa] = useState<'form' | 'confirmar'>('form');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  const carregarHist = () => api.reprogramacoes(p.id).then(setHist).catch(() => setHist([]));
  useEffect(() => {
    carregarHist();
  }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function abrir() {
    setAberto(true);
    setEtapa('form');
    setMsg(null);
    if (!opcoes) api.ondas().then(setOpcoes).catch((e) => setMsg({ ok: false, txt: (e as Error).message }));
  }

  const atual = rotulo(p.onda, p.ano);
  const nova = rotulo(onda || null, ano || null);
  const valido = !!onda && !!ano && nova !== atual && !!categoria && motivo.trim().length >= 5;
  const hoje = new Date().toLocaleDateString('pt-BR');

  async function enviar() {
    setEnviando(true);
    setMsg(null);
    try {
      const r = await api.reprogramar(p.id, { onda, ano, categoria, motivo: motivo.trim() });
      setMsg({ ok: true, txt: `Onda alterada de ${r.de} para ${r.para} e comentário registrado no card.` });
      setAberto(false);
      setMotivo('');
      setCategoria('');
      carregarHist();
      aoMudar();
    } catch (e) {
      setMsg({ ok: false, txt: (e as Error).message });
      setEtapa('form');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Rotulo>Onda de lançamento</Rotulo>
        <b className="text-[14px]">{atual}</b>
        {p.reprogramacoes > 0 && (
          <span className="rounded-full bg-warn-soft px-2 py-px text-[11px] font-semibold text-warn">
            ↻ reprogramada {p.reprogramacoes}x{p.ondaOriginal ? ` · original ${p.ondaOriginal}` : ''}
          </span>
        )}
        {editavel && !aberto && (
          <span className="ml-auto">
            <Botao onClick={abrir}>Reprogramar onda</Botao>
          </span>
        )}
      </div>

      {editavel && aberto && (
        <div className="flex flex-col gap-2 rounded-md bg-sunk px-3 py-2.5">
          {etapa === 'form' ? (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Nova onda
                  <select className={campo} value={onda} onChange={(e) => setOnda(e.target.value)}>
                    <option value="">—</option>
                    {opcoes?.ondas.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Ano
                  <select className={campo} value={ano} onChange={(e) => setAno(e.target.value)}>
                    <option value="">—</option>
                    {opcoes?.anos.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Categoria do motivo
                  <select className={campo} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                    <option value="">Escolha…</option>
                    {MOTIVOS_REPROGRAMACAO.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Motivo (obrigatório — fica registrado no card)
                <textarea
                  className={`${campo} min-h-16`}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: Atraso em Sourcing, sendo assim será reprogramada a data de lançamento"
                />
              </label>
              {nova === atual && onda && ano && <small className="text-xs text-warn">Escolha uma onda diferente da atual.</small>}
              <div className="flex gap-2">
                <Botao primario disabled={!valido} onClick={() => setEtapa('confirmar')}>
                  Revisar
                </Botao>
                <Botao onClick={() => setAberto(false)}>Cancelar</Botao>
              </div>
            </>
          ) : (
            <>
              <span className="text-[13px]">Confirma a reprogramação? Este comentário será criado no card:</span>
              <pre className="m-0 whitespace-pre-wrap rounded border border-line bg-surface px-3 py-2 font-sans text-[13px] leading-relaxed">
                {`🔁 REPROGRAMAÇÃO DE LANÇAMENTO\n🔹Data: ${hoje}\n🔹Onda inicial: ${atual}\n🔹Nova onda: ${nova}\n🔹Categoria: ${categoria}\n🔹Motivo: ${motivo.trim()}`}
              </pre>
              <div className="flex gap-2">
                <Botao primario disabled={enviando} onClick={enviar}>
                  {enviando ? 'Enviando…' : 'Confirmar e registrar no ClickUp'}
                </Botao>
                <Botao onClick={() => setEtapa('form')}>Voltar</Botao>
              </div>
            </>
          )}
          {opcoes && (!opcoes.temOndaOriginal || !opcoes.temContador) && (
            <small className="text-[11px] text-muted">
              Dica: crie na lista os campos {!opcoes.temOndaOriginal && '“ONDA ORIGINAL” (texto)'}
              {!opcoes.temOndaOriginal && !opcoes.temContador && ' e '}
              {!opcoes.temContador && '“REPROGRAMAÇÕES” (número)'} para o web marcar os projetos reprogramados.
            </small>
          )}
        </div>
      )}
      {msg && <small className={`text-xs ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.txt}</small>}

      {hist && hist.length > 0 && (
        <div className="flex flex-col gap-1">
          <Rotulo>Histórico de reprogramações</Rotulo>
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {hist.map((h, i) => (
              <li key={i} className="border-l-2 border-warn pl-2 text-[12.5px]">
                <b>{h.data}</b> · {h.de} → <b>{h.para}</b>
                {h.categoria && <span className="text-muted"> · {h.categoria}</span>}
                <span className="block text-muted">{h.motivo}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
