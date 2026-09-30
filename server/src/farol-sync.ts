/**
 * Farol automático → ClickUp.
 * Calcula Atrasado / Atenção / No Prazo de cada projeto (mesmo cálculo da tela)
 * e grava no campo "Status do Projeto" só quando o valor mudou.
 */
import type { Modelo, Projeto } from '../../shared/types';
import { calcular } from '../../shared/calc';
import { calcularFarol, type Mudanca, type RelatorioFarol } from '../../shared/farol-auto';
import { hojeUTC } from '../../shared/datas';
import { normalizar, regrasFarol } from '../../shared/modelo-padrao';
import { definirCampo, type CUTarefa } from './clickup';
import { config } from './config';

const NOMES_CAMPO = ['Status do Projeto', 'FAROL'];

let ultimo: RelatorioFarol | null = null;
let rodando = false;
export const ultimoRelatorio = () => ultimo;

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Com o farol automático desligado (ou `simular`), só calcula o que mudaria — é a PRÉVIA
 * mostrada na aba Parâmetros antes de ligar.
 */
export async function sincronizarFarol(
  tarefas: CUTarefa[],
  projetos: Projeto[],
  modelo: Modelo,
  simular = false,
): Promise<RelatorioFarol | null> {
  const regras = regrasFarol(modelo);
  const gravar = regras.ativo && !simular && !config.demo;
  if (rodando) return null;
  rodando = true;
  const rel: RelatorioFarol = { em: new Date().toISOString(), ativo: regras.ativo, simulado: !gravar, avaliados: 0, alterados: 0, semMudanca: 0, ignorados: 0, mudancas: [] };
  try {
    if (config.demo) rel.aviso = 'Modo demonstração: nada é gravado no ClickUp.';
    else if (!regras.ativo) rel.aviso = 'Prévia: o farol automático está desligado — nada foi gravado no ClickUp.';
    const hoje = hojeUTC();
    const porId = new Map(tarefas.map((t) => [t.id, t]));
    for (const p of projetos) {
      const res = calcularFarol(calcular(p, modelo, hoje), regras, hoje);
      if (!res) {
        rel.ignorados++;
        continue;
      }
      rel.avaliados++;
      const t = porId.get(p.id);
      const campo = t?.custom_fields.find((c) => NOMES_CAMPO.some((n) => normalizar(n) === normalizar(c.name)));
      if (!t || !campo) {
        rel.aviso = 'Campo "Status do Projeto" não encontrado na lista.';
        continue;
      }
      const opcao = campo.type_config?.options?.find((o) => normalizar(o.name) === normalizar(res.farol));
      if (!opcao) {
        rel.aviso = `A opção "${res.farol}" não existe no campo "${campo.name}".`;
        continue;
      }
      const atual = campo.type_config?.options?.find((o) => o.id === campo.value || o.orderindex === Number(campo.value ?? NaN));
      if (campo.value != null && campo.value !== '' && atual?.id === opcao.id) {
        rel.semMudanca++;
        continue;
      }
      const m: Mudanca = { id: p.id, nome: p.nome, de: atual?.name ?? null, para: res.farol, motivo: res.motivo };
      if (gravar) {
        try {
          await definirCampo(p.id, campo.id, opcao.id);
          await pausa(700); // respeita o limite de requisições do ClickUp
        } catch (e) {
          m.erro = (e as Error).message;
        }
      }
      // reflete já na tela (sem esperar a próxima leitura)
      if (gravar && !m.erro) {
        p.farol = { nome: opcao.name, cor: opcao.color ?? '#999999' };
        campo.value = opcao.id;
        rel.alterados++;
      }
      rel.mudancas.push(m);
    }
    if (rel.mudancas.length) {
      console.log(gravar ? `[farol] ${rel.alterados} card(s) atualizados no ClickUp:` : `[farol] prévia — ${rel.mudancas.length} card(s) mudariam:`);
      for (const m of rel.mudancas) console.log(`  ${m.nome}: ${m.de ?? '—'} → ${m.para} (${m.motivo})${m.erro ? ' ERRO: ' + m.erro : ''}`);
    }
    return rel;
  } finally {
    ultimo = rel;
    rodando = false;
  }
}
