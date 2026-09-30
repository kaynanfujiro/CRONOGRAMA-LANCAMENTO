import { useEffect, useMemo, useState } from 'react';
import { api, type Saude } from './lib/api';
import { calcular } from './lib/calc';
import { hoje as hojeUTC, fmt } from './lib/datas';
import { useProjetos } from './hooks/useProjetos';
import { useModelo } from './hooks/useModelo';
import { Funil } from './components/Funil';
import { Filtros, FILTROS_INICIAIS, type EstadoFiltros } from './components/Filtros';
import { Legenda } from './components/Legenda';
import { Gantt } from './components/Gantt';
import { ProjetoDrawer } from './components/ProjetoDrawer';
import { Parametros } from './pages/Parametros';
import { Dashboards } from './pages/Dashboards';
import { Botao } from './components/ui';
import { FAROIS, nomeFarol } from './lib/farol';

type Aba = 'cronograma' | 'dashboards' | 'parametros';
const ABAS: { id: Aba; nome: string }[] = [
  { id: 'cronograma', nome: 'Cronograma' },
  { id: 'dashboards', nome: 'Dashboards' },
  { id: 'parametros', nome: 'Parâmetros' },
];
/** A aba fica no endereço (#dashboards), então recarregar a página mantém a tela. */
const abaDoHash = (): Aba => {
  const h = window.location.hash.replace('#', '') as Aba;
  return ABAS.some((a) => a.id === h) ? h : 'cronograma';
};

const LINK_LISTA = 'https://app.clickup.com/9007007454/v/b/li/901329151000';

export default function App() {
  const hoje = useMemo(hojeUTC, []);
  const { projetos, sincronizadoEm, carregando, erro, atualizar } = useProjetos();
  const modelo = useModelo(atualizar);
  const [f, setF] = useState<EstadoFiltros>(FILTROS_INICIAIS);
  const [aberto, setAberto] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>(abaDoHash);
  useEffect(() => {
    const ouvir = () => setAba(abaDoHash());
    window.addEventListener('hashchange', ouvir);
    return () => window.removeEventListener('hashchange', ouvir);
  }, []);
  const irPara = (a: Aba) => {
    window.location.hash = a;
    setAba(a);
  };
  const [saude, setSaude] = useState<Saude | null>(null);
  useEffect(() => {
    api.saude().then(setSaude).catch(() => setSaude({ ok: false, erros: ['O servidor Node (porta 3001) não respondeu. Ele está rodando?'], demo: false, arquivoEnv: '', testeClickUp: '' }));
  }, []);

  const todas = useMemo(() => projetos.map((p) => calcular(p, modelo.modelo, hoje)), [projetos, modelo.modelo, hoje]);

  const linhas = useMemo(() => {
    const q = f.busca.trim().toLowerCase();
    const r = todas.filter(({ p, atuais, fases, tipo }) => {
      if (q && !(p.nome.toLowerCase().includes(q) || (p.pvl ?? '').toLowerCase().includes(q))) return false;
      if (f.analista && !(p.analistas.length ? p.analistas : ['Sem responsável']).includes(f.analista)) return false;
      if (f.situacao && p.situacao !== f.situacao) return false;
      if (f.onda && p.onda !== f.onda) return false;
      if (f.fase && !atuais.some((i) => fases[i].nome === f.fase)) return false;
      if (f.farol && nomeFarol(p.farol) !== f.farol) return false;
      if (f.tipo && tipo.id !== f.tipo) return false;
      return true;
    });
    const peso = (x: (typeof r)[number]) => FAROIS.indexOf(nomeFarol(x.p.farol));
    return r.sort((a, b) =>
      f.ordem === 'farol'
        ? peso(a) - peso(b) || (b.desvio ?? -1e9) - (a.desvio ?? -1e9)
        : f.ordem === 'nome'
        ? a.p.nome.localeCompare(b.p.nome)
        : f.ordem === 'desvio'
          ? (b.desvio ?? -1e9) - (a.desvio ?? -1e9)
          : a.lancPlan - b.lancPlan,
    );
  }, [todas, f]);

  const selecionado = todas.find((r) => r.p.id === aberto);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-[18px] px-4 pb-12 pt-5 sm:px-5">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-[3px] border-accent pb-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <img src="/logo-cortag.svg" alt="Cortag" className="h-10 w-auto sm:h-12" />
          <span className="hidden h-12 w-px bg-line sm:block" aria-hidden />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Setor de Produtos</span>
            <h1 className="font-display text-[30px] font-bold uppercase leading-none">Cronograma de Lançamentos</h1>
            <span className="text-xs text-muted">
              Fonte: ClickUp · {projetos.length} projetos
              {sincronizadoEm && ` · atualizado ${new Date(sincronizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`} · hoje:{' '}
              <b className="text-ink">{fmt(hoje)}</b>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao onClick={atualizar} disabled={carregando}>
            {carregando ? 'Atualizando…' : 'Atualizar'}
          </Botao>
          <Botao href={LINK_LISTA}>Abrir lista no ClickUp ↗</Botao>
        </div>
      </header>

      {saude?.demo && (
        <div role="status" className="rounded-lg bg-warn-soft px-3.5 py-2.5 text-[13.5px] text-warn">
          Modo demonstração: estes são projetos de exemplo. Para ver o ClickUp, pare (Ctrl + C) e rode <b>npm run dev</b>.
        </div>
      )}
      {saude && !saude.ok && (
        <div role="status" className="rounded-lg bg-bad-soft px-3.5 py-2.5 text-[13.5px] text-bad">
          <b>Configuração com problema:</b> {saude.erros.join(' · ')}
          {saude.arquivoEnv === 'NÃO ENCONTRADO' && ' — o arquivo .env precisa ficar na mesma pasta do package.json.'}
        </div>
      )}
      {erro && (
        <div role="status" className="rounded-lg bg-bad-soft px-3.5 py-2.5 text-[13.5px] text-bad">
          Não foi possível ler o ClickUp: {erro}
          {projetos.length > 0 && ' — mostrando os últimos dados carregados.'}
        </div>
      )}

      {/* menu */}
      <nav className="-mt-2 flex gap-1 border-b border-line" aria-label="Seções">
        {ABAS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => irPara(x.id)}
            aria-current={aba === x.id ? 'page' : undefined}
            className={`-mb-px border-b-[3px] px-4 py-2.5 font-display text-[15px] font-bold uppercase tracking-wide transition ${
              aba === x.id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {x.nome}
          </button>
        ))}
      </nav>

      {aba !== 'parametros' && <Filtros f={f} set={setF} projetos={projetos} modelo={modelo.modelo} cronograma={aba === 'cronograma'} />}

      {aba === 'cronograma' && (
        <>
          <Funil linhas={linhas} modelo={modelo.modelo} aoClicar={(fase) => setF({ ...f, fase: f.fase === fase ? '' : fase })} />
          <Legenda modelo={modelo.modelo} />
          {carregando && !projetos.length ? (
            <div className="rounded-lg border border-line bg-surface p-7 text-center text-muted">Lendo projetos do ClickUp…</div>
          ) : (
            <Gantt linhas={linhas} hoje={hoje} zoom={f.zoom} aoAbrir={setAberto} />
          )}
        </>
      )}

      {aba === 'dashboards' && (
        <Dashboards
          linhas={linhas}
          modelo={modelo.modelo}
          hoje={hoje}
          farolAtivo={f.farol}
          aoFarol={(farol) => setF({ ...f, farol })}
          aoFase={(fase) => {
            setF({ ...f, fase });
            irPara('cronograma');
          }}
        />
      )}

      {aba === 'parametros' && (
        <Parametros modelo={modelo.modelo} alterar={modelo.alterar} salvando={modelo.salvando} erro={modelo.erro} linhas={todas} />
      )}

      {selecionado && (
        <ProjetoDrawer r={selecionado} modelo={modelo.modelo} hoje={hoje} aoFechar={() => setAberto(null)} aoMudar={atualizar} />
      )}
    </div>
  );
}
