/**
 * Imagem do produto (campo "IMAGEM PRODUTO" do ClickUp).
 *
 * - O navegador pede /api/projetos/:id/imagem; o servidor tenta baixar o arquivo do ClickUp e guarda em memória.
 * - Se o servidor não conseguir (proxy ou certificado da rede da empresa, tempo esgotado, ClickUp recusou),
 *   a rota manda o navegador buscar direto no ClickUp — o navegador usa o proxy e os certificados do Windows.
 * - Só baixa endereços que vieram da própria API do ClickUp, de domínios do ClickUp.
 * - Se o workspace exigir login para ver anexos, tenta de novo com o token do .env.
 */
import { config } from './config';

export interface Arquivo {
  tipo: string;
  corpo: Buffer;
}

/** Memória máxima das imagens guardadas (as mais antigas saem primeiro). */
const LIMITE_BYTES = 80 * 1024 * 1024;
/** Depois de uma falha de rede, o servidor fica este tempo sem tentar baixar (manda direto ao ClickUp). */
const PAUSA_APOS_FALHA_MS = 10 * 60 * 1000;
const TEMPO_MAXIMO_MS = 10_000;

const guardadas = new Map<string, Arquivo>();
let totalBytes = 0;
const emAndamento = new Map<string, Promise<Arquivo>>();
let semRedeAte = 0;
let ultimoAviso = 0;

const DOMINIOS = ['clickup-attachments.com', 'clickup.com', 'clickupusercontent.com'];

export class ErroImagem extends Error {}

/** Texto curto com o motivo real de uma falha de rede (o fetch do Node só diz "fetch failed"). */
export function motivoDoErro(e: unknown): string {
  const err = e as { message?: string; name?: string; cause?: { code?: string; message?: string } };
  const causa = err?.cause?.code ?? err?.cause?.message;
  const base = err?.name === 'TimeoutError' ? `sem resposta em ${TEMPO_MAXIMO_MS / 1000} s` : (err?.message ?? String(e));
  return causa ? `${base} (${causa})` : base;
}

function permitido(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && DOMINIOS.some((d) => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

/** Tipo pela assinatura do arquivo (o ClickUp às vezes entrega imagens como "application/octet-stream"). */
function tipoDaImagem(corpo: Buffer, informado: string): string | null {
  const ini = corpo.subarray(0, 12).toString('latin1');
  if (corpo[0] === 0x89 && ini.slice(1, 4) === 'PNG') return 'image/png';
  if (corpo[0] === 0xff && corpo[1] === 0xd8 && corpo[2] === 0xff) return 'image/jpeg';
  if (ini.startsWith('GIF8')) return 'image/gif';
  if (ini.startsWith('RIFF') && ini.slice(8, 12) === 'WEBP') return 'image/webp';
  if (ini.startsWith('BM')) return 'image/bmp';
  return informado.startsWith('image/') ? informado : null; // svg, avif…
}

async function baixar(url: string): Promise<Arquivo> {
  if (!permitido(url)) throw new ErroImagem('endereço de imagem fora do ClickUp');
  let status = 0;
  // 1ª tentativa sem login (anexos comuns); 2ª com o token (workspace com anexos protegidos)
  for (const comToken of [false, true]) {
    if (comToken && !config.token) break;
    const r = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
      headers: comToken ? { Authorization: config.token } : {},
    });
    status = r.status;
    if (!r.ok) {
      await r.body?.cancel().catch(() => undefined);
      continue;
    }
    const corpo = Buffer.from(await r.arrayBuffer());
    const tipo = tipoDaImagem(corpo, (r.headers.get('content-type') ?? '').split(';')[0].trim());
    if (tipo) return { tipo, corpo };
  }
  throw new ErroImagem(status && status !== 200 ? `o ClickUp respondeu ${status}` : 'o ClickUp não entregou uma imagem');
}

/**
 * Imagem do ClickUp (da memória quando já baixada). Lança erro quando o servidor não consegue baixar;
 * nesse caso a rota redireciona o navegador para o endereço do ClickUp.
 */
export async function imagemDoClickUp(url: string): Promise<Arquivo> {
  const pronta = guardadas.get(url);
  if (pronta) return pronta;
  if (Date.now() < semRedeAte) throw new ErroImagem('servidor sem acesso aos anexos do ClickUp');
  let p = emAndamento.get(url);
  if (!p) {
    p = baixar(url).finally(() => emAndamento.delete(url));
    emAndamento.set(url, p);
  }
  let arq: Arquivo;
  try {
    arq = await p;
  } catch (e) {
    // falha de rede/certificado/tempo: não insiste a cada imagem
    if (!(e instanceof ErroImagem)) semRedeAte = Date.now() + PAUSA_APOS_FALHA_MS;
    throw e;
  }
  if (!guardadas.has(url) && arq.corpo.length < LIMITE_BYTES / 4) {
    guardadas.set(url, arq);
    totalBytes += arq.corpo.length;
    for (const [k, v] of guardadas) {
      if (totalBytes <= LIMITE_BYTES) break;
      guardadas.delete(k);
      totalBytes -= v.corpo.length;
    }
  }
  return arq;
}

/** Registra no terminal (no máximo 1 vez a cada 10 min) que as imagens estão indo direto pelo navegador. */
export function avisarFalha(e: unknown) {
  if (Date.now() - ultimoAviso < PAUSA_APOS_FALHA_MS) return;
  ultimoAviso = Date.now();
  console.warn(
    `[imagens] o servidor não conseguiu baixar uma imagem do ClickUp: ${motivoDoErro(e)}.\n` +
      '          O navegador vai buscar a imagem direto no ClickUp (sem erro na tela).',
  );
}

/** Ilustração para o modo demonstração (sem ClickUp): uma caixa de produto com o código. */
export function imagemDemo(nome: string, codigo: string, n: number): Arquivo {
  const cores = ['#c10230', '#50575d', '#1f7a52', '#9a6400', '#3082b7'];
  const c = cores[n % cores.length];
  const esc = (s: string) => s.replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[x]!);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
<rect width="400" height="300" fill="#ffffff"/>
<g transform="translate(200 138)">
<path d="M-80 -30 L0 -70 L80 -30 L0 10 Z" fill="${c}" opacity=".85"/>
<path d="M-80 -30 L0 10 L0 92 L-80 52 Z" fill="${c}"/>
<path d="M80 -30 L0 10 L0 92 L80 52 Z" fill="${c}" opacity=".65"/>
<path d="M-40 -50 L40 -10 L40 18" fill="none" stroke="#fff" stroke-width="8" opacity=".7"/>
</g>
<text x="200" y="272" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#50575d">${esc(codigo || nome.slice(0, 24))}</text>
</svg>`;
  return { tipo: 'image/svg+xml', corpo: Buffer.from(svg) };
}
