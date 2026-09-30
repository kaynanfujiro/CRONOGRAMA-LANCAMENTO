/** Guarda o modelo de lead time (fases + tipos de projeto) em server/data/modelo.json. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Modelo } from '../../shared/types';
import { MODELO_PADRAO, REGRAS_FAROL_PADRAO } from '../../shared/modelo-padrao';
import { config } from './config';

export function lerModelo(): Modelo {
  try {
    if (existsSync(config.arquivoModelo)) {
      const m = JSON.parse(readFileSync(config.arquivoModelo, 'utf8')) as Modelo;
      // arquivos da versão antiga (um lead time só) são substituídos pelo modelo por tipo
      if (m.versao === 2 && Array.isArray(m.tipos) && m.tipos.length) return m;
      console.warn('[modelo] arquivo da versão antiga — usando o modelo por tipo de projeto.');
    }
  } catch (e) {
    console.warn('[modelo] arquivo inválido, usando o padrão:', (e as Error).message);
  }
  return structuredClone(MODELO_PADRAO);
}

/** Valida e salva. Lança erro com mensagem clara se o modelo estiver inconsistente. */
export function salvarModelo(m: Modelo): Modelo {
  if (!m || !Array.isArray(m.fases) || !Array.isArray(m.tipos) || !m.tipos.length) {
    throw new Error('Modelo inválido: envie { versao: 2, fases: [...], tipos: [...], tipoPadrao }.');
  }
  const nFases = m.fases.length;
  const limpo: Modelo = {
    versao: 2,
    fases: m.fases.map((f) => ({
      nome: String(f.nome),
      cor: String(f.cor),
      status: Array.isArray(f.status) ? f.status.map(String) : [],
    })),
    tipos: m.tipos.map((t) => {
      const blocos = t.blocos.map((b) => ({
        fases: b.fases.map(Number),
        dias: Math.max(0, Math.round(Number(b.dias) || 0)),
      }));
      // cada fase precisa aparecer exatamente uma vez, em ordem
      const ordem = blocos.flatMap((b) => b.fases);
      if (ordem.length !== nFases || ordem.some((f, i) => f !== i)) {
        throw new Error(`Tipo "${t.nome}": os blocos precisam cobrir as ${nFases} fases, em ordem.`);
      }
      return {
        id: String(t.id),
        nome: String(t.nome),
        referencia: String(t.referencia ?? ''),
        meta: Math.max(0, Math.round(Number(t.meta) || 0)),
        blocos,
      };
    }),
    tipoPadrao: m.tipos.some((t) => t.id === m.tipoPadrao) ? m.tipoPadrao : m.tipos[0].id,
    farolAuto: {
      ativo: m.farolAuto?.ativo ?? REGRAS_FAROL_PADRAO.ativo,
      toleranciaDias: Math.max(0, Math.round(Number(m.farolAuto?.toleranciaDias ?? REGRAS_FAROL_PADRAO.toleranciaDias) || 0)),
      atencaoPct: Math.min(100, Math.max(1, Math.round(Number(m.farolAuto?.atencaoPct ?? REGRAS_FAROL_PADRAO.atencaoPct) || 80))),
    },
  };
  mkdirSync(path.dirname(config.arquivoModelo), { recursive: true });
  writeFileSync(config.arquivoModelo, JSON.stringify(limpo, null, 2));
  return limpo;
}
