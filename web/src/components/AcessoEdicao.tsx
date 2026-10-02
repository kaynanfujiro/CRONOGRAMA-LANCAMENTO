/**
 * Botão de acesso no topo: no modo leitura, "Entrar para editar" pede a senha de edição;
 * no modo edição, mostra o selo e "Sair da edição".
 */
import { useEffect, useRef, useState } from 'react';
import { api, type Sessao } from '../lib/api';
import { Botao } from './ui';

export function AcessoEdicao({ sessao, aoMudar }: { sessao: Sessao; aoMudar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) campo.current?.focus();
  }, [aberto]);

  // desenvolvimento sem senha configurada: tudo liberado, nada a mostrar
  if (!sessao.protegido) return null;

  if (sessao.editor)
    return (
      <span className="inline-flex items-center gap-2">
        <span className="rounded-full bg-good-soft px-2.5 py-1 text-[12px] font-semibold text-good">Modo edição</span>
        <Botao
          onClick={async () => {
            await api.sair().catch(() => undefined);
            aoMudar();
          }}
        >
          Sair da edição
        </Botao>
      </span>
    );

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await api.entrar(senha);
      setSenha('');
      setAberto(false);
      aoMudar();
    } catch (x) {
      setErro((x as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <span className="relative inline-flex">
      <Botao onClick={() => setAberto(!aberto)}>Entrar para editar</Botao>
      {aberto && (
        <form
          onSubmit={entrar}
          className="absolute right-0 top-full z-40 mt-2 flex w-72 flex-col gap-2 rounded-lg border border-line bg-surface p-3 shadow-xl"
          onKeyDown={(e) => e.key === 'Escape' && setAberto(false)}
        >
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Senha de edição
            <input
              ref={campo}
              type="password"
              autoComplete="current-password"
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] font-normal normal-case tracking-normal text-ink"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </label>
          {erro && <small className="text-xs text-bad">{erro}</small>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!senha || enviando}
              className="inline-flex items-center rounded-md border border-accent bg-accent px-3 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
            <Botao onClick={() => setAberto(false)}>Cancelar</Botao>
          </div>
          <small className="text-[11px] text-muted">Sem a senha, o web fica só para visualização (Cronograma e Dashboards).</small>
        </form>
      )}
    </span>
  );
}
