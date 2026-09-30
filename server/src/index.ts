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

const app = express();
app.use(express.json({ limit: '200kb' }));

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
      token: config.token ? config.token.slice(0, 6) + '…' + config.token.slice(-4) : '(vazio)',
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

app.get('/api/farol', (_req, res) => {
  res.json(ultimoRelatorio());
});

app.post(
  '/api/farol/sincronizar',
  rota(async (req, res) => {
    const modelo = lerModelo();
    const { tarefas, projetos } = await lerClickUp(modelo);
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
  const msg = err instanceof Error ? err.message : 'Erro inesperado.';
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
  // farol automático: roda ao subir e depois a cada FAROL_MINUTOS, mesmo sem a tela aberta
  if (config.farolMinutos > 0 && !erros.length) {
    const rodar = () => buscarProjetos(true).catch((e) => console.warn('[farol]', (e as Error).message));
    setTimeout(rodar, 3000);
    setInterval(rodar, config.farolMinutos * 60_000);
    console.log(`  farol automático: a cada ${config.farolMinutos} min (liga/desliga na aba Parâmetros)`);
  }
});
