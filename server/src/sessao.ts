/**
 * Acesso: por padrão o web é só leitura (Cronograma e Dashboards). Quem digita a senha de edição pode mudar
 * fase, reprogramar onda, registrar follow-up e editar Parâmetros. A senha vem embutida no projeto
 * (`npm run senha` → server/src/acesso.json, só o resumo scrypt) ou da variável SENHA_EDICAO, que tem prioridade.
 *
 * Sem banco de dados: a "sessão" é um cookie assinado com HMAC (validade + assinatura).
 * Trocar a senha derruba todas as sessões de edição abertas.
 */
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config';

const COOKIE = 'cronograma_edicao';
const VALIDADE_DIAS = 30;
const TENTATIVAS_POR_MINUTO = 5;

/** Existe senha de edição (variável SENHA_EDICAO ou embutida com `npm run senha`)? */
const temSenha = () => !!config.senhaEdicao || !!config.senhaHash;

/** Proteção ligada? Com senha, sempre. Sem senha: em produção ninguém edita; em desenvolvimento, todos. */
export const protegido = () => temSenha() || config.producao;

const chave = () => createHash('sha256').update(`cronograma-edicao:${config.senhaEdicao || config.senhaHash}`).digest();

/** Resumo scrypt no formato "scrypt$<sal>$<resumo>" (o que fica gravado em acesso.json). */
export function resumirSenha(senha: string, sal = randomBytes(16).toString('base64url')) {
  return `scrypt$${sal}$${scryptSync(senha, sal, 32).toString('base64url')}`;
}

function senhaConfere(senha: string): boolean {
  if (config.senhaEdicao) return iguais(senha, config.senhaEdicao);
  const [tipo, sal, resumo] = config.senhaHash.split('$');
  if (tipo !== 'scrypt' || !sal || !resumo) return false;
  return iguais(resumirSenha(senha, sal), config.senhaHash);
}
const assinar = (validade: number) => createHmac('sha256', chave()).update(String(validade)).digest('base64url');

function iguais(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function lerCookie(req: Request): string | null {
  const bruto = req.headers.cookie ?? '';
  for (const parte of bruto.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** A requisição veio de alguém com acesso de edição? */
export function podeEditar(req: Request): boolean {
  if (!protegido()) return true;
  if (!temSenha()) return false; // produção sem senha configurada: só leitura
  const c = lerCookie(req);
  if (!c) return false;
  const [validade, assinatura] = c.split('.');
  const ms = Number(validade);
  return Number.isFinite(ms) && ms > Date.now() && !!assinatura && iguais(assinatura, assinar(ms));
}

/** Middleware das rotas que alteram o ClickUp ou o modelo. */
export function exigirEdicao(req: Request, res: Response, next: NextFunction) {
  if (podeEditar(req)) return next();
  res.status(403).json({ erro: 'Acesso só de leitura. Entre com a senha de edição para alterar.' });
}

const tentativas = new Map<string, number[]>();

/** Confere a senha e grava o cookie de edição. Devolve uma mensagem de erro ou null. */
export function entrar(req: Request, res: Response, senha: unknown): string | null {
  if (!temSenha()) return 'A senha de edição não está configurada (rode npm run senha no projeto).';
  const ip = req.ip ?? 'x';
  const agora = Date.now();
  const recentes = (tentativas.get(ip) ?? []).filter((t) => agora - t < 60_000);
  if (recentes.length >= TENTATIVAS_POR_MINUTO) return 'Muitas tentativas. Aguarde 1 minuto.';
  if (typeof senha !== 'string' || !senhaConfere(senha)) {
    tentativas.set(ip, [...recentes, agora]);
    return 'Senha incorreta.';
  }
  tentativas.delete(ip);
  const validade = agora + VALIDADE_DIAS * 864e5;
  res.cookie(COOKIE, `${validade}.${assinar(validade)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: VALIDADE_DIAS * 864e5,
    path: '/',
  });
  return null;
}

export function sair(res: Response) {
  res.clearCookie(COOKIE, { path: '/' });
}
