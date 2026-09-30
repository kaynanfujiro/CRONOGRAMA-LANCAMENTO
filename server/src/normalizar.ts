/**
 * Converte uma tarefa do ClickUp + histórico de status em um Projeto.
 *
 * Regras:
 * - status do card = fase atual;
 * - cada mudança de status registrada = início real da nova fase e fim real da anterior;
 * - o status em que o card foi criado não tem data real de início
 *   (o projeto já estava nessa fase antes de existir no ClickUp), exceto a 1ª fase;
 * - fases anteriores à primeira registrada contam como concluídas, sem data.
 */
import type { Farol, FaseReal, Modelo, Projeto, Situacao } from '../../shared/types';
import { faseDoStatus, normalizar } from '../../shared/modelo-padrao';
import type { CUCampo, CUTarefa, CUTempoStatus } from './clickup';

/** Minutos abaixo dos quais uma passagem por um status é tratada como correção e ignorada. */
const MIN_CORRECAO = 60;

/** Nomes dos campos personalizados na lista (maiúsculas/acentos não importam). */
export const CAMPOS = {
  pvl: ['CÓDIGO PVL', 'Código Projeto'],
  familia: ['FAMÍLIA'],
  itens: ['QUANTIDADE SUBITENS'],
  onda: ['ONDA - LANÇAMENTO'],
  ano: ['ANO LANÇAMENTO', 'ANO DE LANÇAMENTO'],
  forecast: ['Forecast Inícial', 'Forecast Inicial', 'FORECAST'],
  lancMeta: ['DATA LANÇAMENTO META', 'DATA DE LANÇAMENTO'],
  inicioReal: ['DATA INÍCIO REAL'],
  conclusaoReal: ['DATA CONCLUSÃO REAL'],
  farol: ['Status do Projeto', 'FAROL'],
  tipo: ['TIPO DE PROJETO', 'Tipo de Projeto', 'TIPO PROJETO', 'Tipo Projeto'],
  proximoPasso: ['PRÓXIMO PASSO', 'PROXIMO PASSO'],
  inicioFaseAtual: ['INÍCIO FASE ATUAL', 'INICIO FASE ATUAL'],
  /** Reprogramação de onda: 1ª onda planejada (preenchida na 1ª mudança) e quantas vezes mudou. */
  ondaOriginal: ['ONDA ORIGINAL', 'ONDA INICIAL'],
  reprogramacoes: ['REPROGRAMAÇÕES', 'REPROGRAMAÇÕES (ONDA)', 'REPROGRAMAÇÕES ONDA', 'QTD REPROGRAMAÇÕES'],
  /** Fases que não se aplicam ao projeto (campo Rótulos / Labels com os nomes das fases). */
  dispensadas: ['FASES DISPENSADAS', 'FASE DISPENSADA', 'FASES NÃO APLICÁVEIS', 'FASES QUE NÃO SE APLICAM'],
  /** Responsável pelo projeto (em teste: "Solicitante do Teste"); vazio → responsáveis do card. */
  responsavel: ['Solicitante do Teste', 'RESPONSÁVEL'],
};

export function campo(t: CUTarefa, nomes: string[]): CUCampo | undefined {
  // primeiro nome exato (distingue "FAMÍLIA" do antigo "Família"), depois normalizado
  for (const n of nomes) {
    const f = t.custom_fields.find((c) => c.name === n);
    if (f) return f;
  }
  for (const n of nomes) {
    const f = t.custom_fields.find((c) => normalizar(c.name) === normalizar(n));
    if (f) return f;
  }
  return undefined;
}

export function valorTexto(f?: CUCampo): string | null {
  if (!f || f.value == null || f.value === '') return null;
  if (f.type === 'drop_down') {
    const op = f.type_config?.options?.find((o) => o.orderindex === Number(f.value) || o.id === f.value);
    return op?.name ?? null;
  }
  return String(f.value);
}
function valorOpcao(f?: CUCampo): Farol | null {
  if (!f || f.value == null || f.value === '' || f.type !== 'drop_down') return null;
  const op = f.type_config?.options?.find((o) => o.orderindex === Number(f.value) || o.id === f.value);
  return op ? { nome: op.name, cor: op.color ?? '#999999' } : null;
}
function valorNumero(f?: CUCampo): number | null {
  if (!f || f.value == null || f.value === '') return null;
  const n = Number(f.value);
  return Number.isFinite(n) ? n : null;
}
function valorData(f?: CUCampo): string | null {
  const n = valorNumero(f);
  return n == null ? null : diaISO(n);
}

/**
 * Lê as fases dispensadas. Aceita campo Rótulos/Labels (recomendado), lista suspensa
 * ou texto separado por vírgula/ponto e vírgula. Nomes podem ser o da fase ou o do status.
 */
function fasesDispensadas(f: CUCampo | undefined, modelo: Modelo): number[] {
  if (!f || f.value == null || f.value === '') return [];
  const ops = f.type_config?.options ?? [];
  const nomeOp = (v: unknown) => {
    const o = ops.find((x) => x.id === v || x.orderindex === Number(v));
    return o ? (o.label ?? o.name) : null;
  };
  let nomes: (string | null)[];
  if (f.type === 'labels' && Array.isArray(f.value)) nomes = f.value.map(nomeOp);
  else if (f.type === 'drop_down') nomes = [nomeOp(f.value)];
  else nomes = String(f.value).split(/[;,\n]+/);
  // aceita nomes exatos e variações com texto a mais (ex.: "CADASTRO SKU, NCM, ETC" → "Cadastro SKU / NCM")
  const fase = (n: string) => {
    const exata = faseDoStatus(modelo, n.trim());
    if (typeof exata === 'number') return exata;
    const k = normalizar(n);
    const i = modelo.fases.findIndex((f) =>
      [f.nome, ...f.status].some((x) => {
        const y = normalizar(x);
        return !!y && (k.startsWith(y) || y.startsWith(k));
      }),
    );
    return i >= 0 ? i : null;
  };
  const idx = nomes
    .map((n) => (n ? fase(n) : null))
    .filter((i): i is number => typeof i === 'number' && i >= 0);
  return [...new Set(idx)].sort((a, b) => a - b);
}

/** Vezes que a onda foi reprogramada: o contador ou, se vazio, 1 quando a onda original difere da atual. */
function contarReprogramacoes(t: CUTarefa): number {
  const n = valorNumero(campo(t, CAMPOS.reprogramacoes));
  if (n) return n;
  const original = valorTexto(campo(t, CAMPOS.ondaOriginal));
  const onda = valorTexto(campo(t, CAMPOS.onda));
  const ano = valorTexto(campo(t, CAMPOS.ano));
  const atual = onda ? `${onda}${ano ? ' - ' + ano : ''}` : null;
  return original && atual && normalizar(original) !== normalizar(atual) ? 1 : 0;
}

/** Responsável do campo personalizado; se vazio, os responsáveis (assignees) do card. */
function responsaveis(t: CUTarefa): string[] {
  const doCampo = valorTexto(campo(t, CAMPOS.responsavel));
  if (doCampo) return [doCampo];
  return t.assignees.map((a) => a.username || a.email || '').filter(Boolean);
}

/** Converte milissegundos em data ISO do dia (fuso de Brasília). */
export function diaISO(ms: number | string | null | undefined): string | null {
  if (ms == null || ms === '') return null;
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD
}

export function paraProjeto(t: CUTarefa, tempo: CUTempoStatus | undefined, modelo: Modelo): Projeto {
  const dispensadas = fasesDispensadas(campo(t, CAMPOS.dispensadas), modelo);
  // última fase que se aplica ao projeto (se "Ciclo de vida" for dispensada, é a anterior)
  let ultima = modelo.fases.length - 1;
  while (ultima > 0 && dispensadas.includes(ultima)) ultima--;
  const criado = diaISO(t.date_created);

  // histórico em ordem cronológica, sem as "correções": status em que o card ficou
  // menos de MIN_CORRECAO minutos (arrastou errado / ajuste na importação). O status atual sempre fica.
  const hist = (tempo?.status_history ?? [])
    .filter((h) => normalizar(h.status) === normalizar(t.status.status) || !(h.total_time?.by_minute < MIN_CORRECAO))
    .map((h) => ({ fase: faseDoStatus(modelo, h.status), desde: diaISO(h.total_time?.since) }))
    .filter((h): h is { fase: ReturnType<typeof faseDoStatus>; desde: string } => h.desde != null)
    .sort((a, b) => a.desde.localeCompare(b.desde));
  if (!hist.length) hist.push({ fase: faseDoStatus(modelo, t.status.status), desde: criado ?? '' });

  const real: Record<number, FaseReal> = {};
  let situacao: Situacao = 'Andamento';
  let maiorFase = -1;

  hist.forEach((h, j) => {
    if (h.fase === 'x') {
      situacao = 'Cancelado';
      return;
    }
    if (h.fase == null || h.fase < 0) return;
    const prox = hist.slice(j + 1).find((n) => typeof n.fase === 'number' && n.fase >= 0);
    const semInicio = j === 0 && h.desde === criado && h.fase > 0;
    const r: FaseReal = {};
    if (!semInicio) r.ini = h.desde;
    if (prox) {
      r.fim = prox.desde;
      r.feito = true;
    } else r.emCurso = true;
    real[h.fase] = { ...(real[h.fase] ?? {}), ...r };
    maiorFase = Math.max(maiorFase, h.fase);
  });

  // fases puladas: o card foi de uma fase direto para outra mais à frente (ex.: First order → Envio 1º lote)
  // Só conta como "pulada" o salto entre duas fases de trabalho seguidas. A 1ª fase registrada e a fase
  // que vem depois do Backlog são o PONTO DE ENTRADA do projeto no ClickUp: o que veio antes é histórico
  // anterior (concluído, sem data), não fase pulada.
  const puladasHist = new Set<number>();
  let anterior: number | null = null;
  for (const h of hist) {
    if (h.fase === -1 || h.fase === 'x' || h.fase == null) {
      anterior = null;
      continue;
    }
    if (anterior != null) for (let i = anterior + 1; i < h.fase; i++) puladasHist.add(i);
    anterior = h.fase;
  }
  for (const i of [...puladasHist]) if (real[i]) puladasHist.delete(i);

  for (let i = 0; i < maiorFase; i++) if (!real[i]) real[i] = { feito: true };
  for (const r of Object.values(real)) if (r.feito) delete r.emCurso;

  // a fase atual é sempre a do status de agora
  const atual = faseDoStatus(modelo, t.status.status);
  if (atual === 'x') situacao = 'Cancelado';
  else if (atual === -1 && maiorFase < 0) situacao = 'Backlog';
  else if (typeof atual === 'number' && atual >= 0 && real[atual]) {
    delete real[atual].fim;
    delete real[atual].feito;
    real[atual].emCurso = true;
  }
  // "INÍCIO FASE ATUAL" preenchido à mão vale mais que o histórico (projeto já estava na fase antes do ClickUp)
  const inicioManual = valorData(campo(t, CAMPOS.inicioFaseAtual));
  if (inicioManual && typeof atual === 'number' && atual >= 0 && real[atual]) real[atual].ini = inicioManual;

  for (const i of dispensadas) if (i !== atual) delete real[i];
  if (real[ultima] && situacao !== 'Cancelado') {
    situacao = 'Concluído';
    real[ultima].emCurso = false;
  }

  const puladas = [...puladasHist].filter((i) => !dispensadas.includes(i)).sort((a, b) => a - b);

  return {
    id: t.id,
    nome: t.name,
    url: t.url,
    pvl: valorTexto(campo(t, CAMPOS.pvl)),
    familia: valorTexto(campo(t, CAMPOS.familia)),
    analistas: responsaveis(t),
    itens: valorNumero(campo(t, CAMPOS.itens)),
    onda: valorTexto(campo(t, CAMPOS.onda)),
    ano: valorTexto(campo(t, CAMPOS.ano)),
    ondaOriginal: valorTexto(campo(t, CAMPOS.ondaOriginal)),
    reprogramacoes: contarReprogramacoes(t),
    forecast: valorNumero(campo(t, CAMPOS.forecast)),
    statusClickUp: t.status.status,
    corStatus: t.status.color ?? null,
    situacao,
    farol: valorOpcao(campo(t, CAMPOS.farol)),
    tipo: valorTexto(campo(t, CAMPOS.tipo)),
    proximoPasso: valorTexto(campo(t, CAMPOS.proximoPasso)),
    inicioPlan: diaISO(t.start_date) ?? criado ?? new Date().toISOString().slice(0, 10),
    vencimentoPlan: diaISO(t.due_date),
    dataLancamentoMeta: valorData(campo(t, CAMPOS.lancMeta)),
    inicioRealInformado: valorData(campo(t, CAMPOS.inicioReal)),
    conclusaoRealInformada: valorData(campo(t, CAMPOS.conclusaoReal)),
    real,
    dispensadas,
    puladas,
    atualizadoEm: diaISO(t.date_updated),
  };
}
