import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(aqui, '../..');

/**
 * Carrega o .env sem depender da versão do Node.
 * Procura na raiz do projeto (ao lado do package.json) e, se não achar, na pasta de cima
 * (caso o .env tenha sido criado fora da pasta descompactada).
 */
function carregarEnv(): string | null {
  const candidatos = [
    path.join(RAIZ, '.env'),
    path.join(RAIZ, '..', '.env'),
    path.join(process.cwd(), '.env'),
    path.join(RAIZ, '.env.txt'), // Bloco de Notas às vezes salva como .env.txt
  ];
  const arquivo = candidatos.find((c) => existsSync(c));
  if (!arquivo) return null;
  const texto = readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, ''); // remove BOM do Bloco de Notas
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let valor = m[2];
    if (/^(['"]).*\1$/.test(valor)) valor = valor.slice(1, -1); // aceita valor entre aspas
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
  return arquivo;
}
export const arquivoEnv = carregarEnv();

export const config = {
  token: (process.env.CLICKUP_TOKEN ?? '').trim(),
  listId: process.env.CLICKUP_LIST_ID ?? '901329151000',
  porta: Number(process.env.PORT ?? 3001),
  cacheSegundos: Number(process.env.CACHE_SECONDS ?? 60),
  /** De quantos em quantos minutos o servidor recalcula e grava o farol no ClickUp (0 = só quando alguém abre a tela). */
  farolMinutos: Number(process.env.FAROL_MINUTOS ?? 30),
  /** Com --demo (ou DEMO=1), usa dados de exemplo em vez do ClickUp (útil para testar a tela sem token). */
  demo: process.env.DEMO === '1' || process.argv.includes('--demo'),
  arquivoModelo: path.join(RAIZ, 'server/data/modelo.json'),
  pastaWeb: path.join(RAIZ, 'web/dist'),
};

export function validarConfig(): string[] {
  const erros: string[] = [];
  if (!config.demo && !config.token.startsWith('pk_')) {
    erros.push('CLICKUP_TOKEN ausente ou inválido no arquivo .env (deve começar com pk_).');
  }
  if (!config.listId) erros.push('CLICKUP_LIST_ID ausente no .env.');
  return erros;
}
