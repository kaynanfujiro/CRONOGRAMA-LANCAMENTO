/**
 * API do cronograma. O navegador nunca vê o token do ClickUp: ele fica só aqui.
 *
 * GET  /api/projetos            projetos da lista (cache de CACHE_SECONDS; ?atualizar=1 força leitura)
 * GET  /api/status              status configurados na lista do ClickUp
 * GET  /api/modelo              modelo de lead time
 * PUT  /api/modelo              salva o modelo de lead time
 * PATCH /api/projetos/:id/status  muda a fase (status) do card no ClickUp
 * GET  /api/ondas                opções de onda/ano para reprogramar
 * POST /api/projetos/:id/onda    reprograma a onda (campos + comentário de evidência no card)
 * GET  /api/projetos/:id/reprogramacoes  histórico (lido dos comentários do card)
 * GET  /api/projetos/:id/imagem  foto do produto (campo "IMAGEM PRODUTO"; ?tam=p = miniatura)
 * GET  /api/projetos/:id/followups  follow-ups já registrados (lidos dos comentários do card)
 * POST /api/projetos/:id/followup   registra um follow-up como comentário no card ({ "comentario": "..." })
 * GET  /api/farol               último relatório do farol automático
 * POST /api/farol/sincronizar   recalcula e grava o farol no ClickUp agora (?simular=1 = só prévia)
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { RespostaProjetos, StatusLista } from '../../shared/types';
import { arquivoEnv, config, validarConfig } from './config';
import { ErroClickUp, listarTarefas, mudarStatus, statusDaLista } from './clickup';
import { lerModelo, salvarModelo } from './modelo-store';
import { lerClickUp } from './leitura';
import { sincronizarFarol, ultimoRelatorio } from './farol-sync';
import { ErroPedido, historico, opcoesOnda, reprogramar } from './reprogramacao';
import type { CUTarefa } from './clickup';
import { anexoImagem, CAMPOS, campo, valorTexto } from './normalizar';
import { avisarFalha, imagemDemo, imagemDoClickUp, motivoDoErro, type Arquivo } from './imagens';
import { followups, registrarFollowup } from './followup';
import { entrar, exigirEdicao, podeEditar, protegido, sair } from './sessao';

const app = express();
app.use(express.json({ limit: '200kb' }));
app.set('trust proxy', 'loopback');

/**
 * Acesso de leitura × edição. Toda rota da API que altera algo (qualquer método que não seja GET)
 * exige a senha de edição — inclusive rotas novas que forem criadas depois.
 */
app.use('/api', (req, res, next) => (req.method === 'GET' || req.path === '/sessao' ? next() : exigirEdicao(req, res, next)));

app.get('/api/sessao', (req, res) => {
  res.json({ editor: podeEditar(req), protegido: protegido(), senhaConfigurada: !!config.senhaEdicao || !!config.senhaHash });
});
app.post('/api/sessao', (req, res) => {
  const erro = entrar(req, res, req.body?.senha);
  if (erro) res.status(erro === 'Senha incorreta.' ? 401 : 400).json({ erro });
  else res.json({ editor: true });
});
app.delete('/api/sessao', (_req, res) => {
  sair(res);
  res.json({ editor: false });
});

let cache: { em: number; dados: RespostaProjetos } | null = null;
/** Tarefas cruas da última leitura (opções dos campos, ids). */
let ultimasTarefas: CUTarefa[] = [];

async function buscarProjetos(forcar: boolean): Promise<RespostaProjetos> {
  if (!forcar && cache && Date.now() - cache.em < config.cacheSegundos * 1000) {
    return { ...cache.dados, origem: 'cache' };
  }
  const modelo = lerModelo();
  const { tarefas, projetos } = await lerClickUp(modelo);
  ultimasTarefas = tarefas;
  const dados: RespostaProjetos = { projetos, sincronizadoEm: new Date().toISOString(), origem: 'clickup' };
  cache = { em: Date.now(), dados };
  // farol automático em segundo plano (grava só o que mudou; a tela já recebe o valor novo na próxima leitura)
  sincronizarFarol(tarefas, projetos, modelo).catch((e) => console.warn('[farol]', (e as Error).message));
  return dados;
}

// helper para rotas async
const rota =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/** Diagnóstico: abra http://localhost:3001/api/saude no navegador. */
app.get(
  '/api/saude',
  rota(async (_req, res) => {
    const erros = validarConfig();
    let teste = 'não testado';
    if (!erros.length && !config.demo) {
      try {
        const lidas = await listarTarefas(config.listId);
        teste = `ok — ${lidas.length} tarefas encontradas na lista`;
      } catch (e) {
        teste = 'falhou: ' + (e as Error).message;
        erros.push(teste);
      }
    }
    res.json({
      ok: erros.length === 0,
      erros,
      demo: config.demo,
      arquivoEnv: arquivoEnv ?? 'NÃO ENCONTRADO',
      token: !podeEditar(_req) ? '(oculto no modo leitura)' : config.token ? config.token.slice(0, 6) + '…' + config.token.slice(-4) : '(vazio)',
      lista: config.listId,
      testeClickUp: teste,
    });
  }),
);

app.get(
  '/api/projetos',
  rota(async (req, res) => {
    res.json(await buscarProjetos(req.query.atualizar === '1'));
  }),
);

app.get(
  '/api/status',
  rota(async (_req, res) => {
    if (config.demo) {
      res.json(lerModelo().fases.map((f) => ({ status: f.status[0], cor: f.cor, tipo: 'custom' })));
      return;
    }
    const lista: StatusLista[] = (await statusDaLista(config.listId)).map((s) => ({
      status: s.status,
      cor: s.color,
      tipo: s.type,
    }));
    res.json(lista);
  }),
);

app.get('/api/modelo', (_req, res) => {
  res.json(lerModelo());
});

app.put('/api/modelo', (req, res) => {
  try {
    const salvo = salvarModelo(req.body);
    cache = null;
    res.json(salvo);
  } catch (e) {
    res.status(400).json({ erro: (e as Error).message });
  }
});

app.patch(
  '/api/projetos/:id/status',
  rota(async (req, res) => {
    const status = String(req.body?.status ?? '').trim();
    if (!status) {
      res.status(400).json({ erro: 'Informe o novo status.' });
      return;
    }
    if (config.demo) {
      res.status(400).json({ erro: 'No modo demonstração não é possível mudar o ClickUp.' });
      return;
    }
    await mudarStatus(req.params.id, status);
    cache = null;
    res.json({ ok: true });
  }),
);

app.get(
  '/api/ondas',
  rota(async (_req, res) => {
    if (!ultimasTarefas.length) await buscarProjetos(true);
    res.json(opcoesOnda(ultimasTarefas[0]));
  }),
);

app.post(
  '/api/projetos/:id/onda',
  rota(async (req, res) => {
    if (config.demo) {
      res.status(400).json({ erro: 'No modo demonstração não é possível mudar o ClickUp.' });
      return;
    }
    try {
      const r = await reprogramar(req.params.id, req.body ?? {});
      cache = null;
      res.json(r);
    } catch (e) {
      if (e instanceof ErroPedido) res.status(400).json({ erro: e.message });
      else throw e;
    }
  }),
);

app.get(
  '/api/projetos/:id/reprogramacoes',
  rota(async (req, res) => {
    res.json(config.demo ? [] : await historico(req.params.id));
  }),
);

app.get(
  '/api/projetos/:id/followups',
  rota(async (req, res) => {
    res.json(config.demo ? [] : await followups(req.params.id));
  }),
);

/** Follow-up: só cria um comentário no card ("♦️DATA:" / "♦️Comentário:"); não mexe em nenhum campo. */
app.post(
  '/api/projetos/:id/followup',
  rota(async (req, res) => {
    if (config.demo) {
      res.status(400).json({ erro: 'No modo demonstração não é possível mudar o ClickUp.' });
      return;
    }
    try {
      res.json(await registrarFollowup(req.params.id, req.body?.comentario));
    } catch (e) {
      if (e instanceof ErroPedido) res.status(400).json({ erro: e.message });
      else throw e;
    }
  }),
);

/** Foto do produto. O endereço leva ?v=<id do anexo>: trocou a imagem no card, muda o endereço. */
let leituraInicial: Promise<unknown> | null = null;
app.get(
  '/api/projetos/:id/imagem',
  rota(async (req, res) => {
    // servidor recém-iniciado: uma única leitura do ClickUp atende todas as imagens pedidas juntas
    if (!ultimasTarefas.length) await (leituraInicial ??= buscarProjetos(true).finally(() => (leituraInicial = null)));
    const t = ultimasTarefas.find((x) => x.id === req.params.id);
    const anexo = t ? anexoImagem(t) : null;
    if (!t || !anexo) {
      res.status(404).json({ erro: 'Projeto sem imagem no campo IMAGEM PRODUTO.' });
      return;
    }
    const url = req.query.tam === 'p' ? anexo.miniatura : anexo.url;
    let arq: Arquivo;
    if (config.demo && url.startsWith('demo:')) {
      arq = imagemDemo(t.name, valorTexto(campo(t, CAMPOS.pvl)) ?? '', ultimasTarefas.indexOf(t));
    } else {
      try {
        arq = await imagemDoClickUp(url);
      } catch (e) {
        // o servidor não conseguiu baixar (proxy/certificado da rede, tempo esgotado…):
        // o navegador busca direto no ClickUp, com o proxy e os certificados do Windows
        avisarFalha(e);
        res.set('Cache-Control', 'no-store').redirect(302, url);
        return;
      }
    }
    res.set({
      'Content-Type': arq.tipo,
      'Cache-Control': req.query.v === anexo.id ? 'private, max-age=604800, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    });
    res.send(arq.corpo);
  }),
);

app.get('/api/farol', (_req, res) => {
  res.json(ultimoRelatorio());
});

app.post(
  '/api/farol/sincronizar',
  rota(async (req, res) => {
    const modelo = lerModelo();
    const { tarefas, projetos } = await lerClickUp(modelo);
    ultimasTarefas = tarefas;
    const rel = await sincronizarFarol(tarefas, projetos, modelo, req.query.simular === '1');
    cache = { em: Date.now(), dados: { projetos, sincronizadoEm: new Date().toISOString(), origem: 'clickup' } };
    res.json(rel ?? { aviso: 'Já existe uma atualização em andamento; tente em 1 minuto.' });
  }),
);

// Em produção, o mesmo servidor entrega o site (web/dist)
if (existsSync(config.pastaWeb)) {
  app.use(express.static(config.pastaWeb));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(config.pastaWeb, 'index.html')));
}

// erros
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof ErroClickUp ? (err.status === 401 ? 401 : 502) : 500;
  // "fetch failed" sozinho não diz nada: inclui o motivo real (certificado, proxy, DNS…)
  const msg = err instanceof Error ? (err instanceof ErroClickUp ? err.message : motivoDoErro(err)) : 'Erro inesperado.';
  console.error('[api]', msg);
  res.status(status).json({ erro: msg });
});

const erros = validarConfig();
if (erros.length) {
  console.warn('\n⚠️  Configuração incompleta:\n - ' + erros.join('\n - ') + '\n   Copie .env.example para .env e preencha.\n');
}

app.listen(config.porta, () => {
  console.log(`API do cronograma em http://localhost:${config.porta}${config.demo ? '  (modo DEMO)' : ''}`);
  console.log(`  .env: ${arquivoEnv ?? 'NÃO ENCONTRADO (crie o arquivo .env ao lado do package.json)'}`);
  console.log(`  diagnóstico: http://localhost:${config.porta}/api/saude`);
  console.log(
    config.senhaEdicao || config.senhaHash
      ? `  acesso: só leitura para todos; alterações liberadas com a senha de edição (${config.senhaEdicao ? 'variável SENHA_EDICAO' : 'embutida em server/src/acesso.json'})`
      : config.producao
        ? '  acesso: SÓ LEITURA para todos (rode npm run senha para definir a senha de edição)'
        : '  acesso: alterações liberadas para todos (desenvolvimento, sem senha de edição)',
  );
  // farol automático: roda ao subir e depois a cada FAROL_MINUTOS, mesmo sem a tela aberta
  if (config.farolMinutos > 0 && !erros.length) {
    const rodar = () => buscarProjetos(true).catch((e) => console.warn('[farol]', (e as Error).message));
    setTimeout(rodar, 3000);
    setInterval(rodar, config.farolMinutos * 60_000);
    console.log(`  farol automático: a cada ${config.farolMinutos} min (liga/desliga na aba Parâmetros)`);
  }
});
