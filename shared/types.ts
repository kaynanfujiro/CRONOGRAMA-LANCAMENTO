/**
 * Tipos compartilhados entre o servidor (Node) e o web (React).
 * O servidor converte as tarefas do ClickUp neste formato; o web só lê.
 */

/** Situação real de uma fase de um projeto. Datas em ISO (AAAA-MM-DD). */
export interface FaseReal {
  /** Data em que o card entrou nesta fase (vem do histórico de status do ClickUp). */
  ini?: string;
  /** Data em que o card saiu desta fase. */
  fim?: string;
  /** Fase concluída (mesmo sem datas — ex.: histórico anterior ao ClickUp). */
  feito?: boolean;
  /** Fase em andamento agora. */
  emCurso?: boolean;
}

/** Farol decidido no follow-up (campo "Status do Projeto" no ClickUp). */
export interface Farol {
  nome: string; // ex.: "No Prazo", "Atenção", "Atrasado"
  cor: string; // cor da opção no ClickUp
}

export type Situacao = 'Backlog' | 'Andamento' | 'Concluído' | 'Cancelado';

/**
 * Imagem do produto (campo de anexo "IMAGEM PRODUTO" no ClickUp).
 * Os endereços são do nosso servidor (/api/projetos/:id/imagem): o navegador não fala com o ClickUp.
 */
export interface ImagemProduto {
  /** Imagem original (topo do detalhe do projeto). */
  url: string;
  /** Versão reduzida do ClickUp (coluna do cronograma). */
  miniatura: string;
  /** Nome do arquivo no ClickUp. */
  titulo: string | null;
  /** Tamanho original em pixels (para não ampliar demais imagens pequenas). */
  largura: number | null;
  altura: number | null;
}

export interface Projeto {
  id: string; // id da tarefa no ClickUp
  nome: string;
  url: string;
  pvl: string | null;
  /** Foto do produto (null = campo "IMAGEM PRODUTO" vazio). */
  imagem: ImagemProduto | null;
  familia: string | null;
  analistas: string[];
  itens: number | null;
  onda: string | null;
  ano: string | null;
  /** Onda planejada originalmente ("ONDA 1 - 2027"); preenchida na 1ª reprogramação. */
  ondaOriginal: string | null;
  /** Quantas vezes a onda de lançamento foi reprogramada. */
  reprogramacoes: number;
  forecast: number | null;
  statusClickUp: string;
  corStatus: string | null;
  situacao: Situacao;
  /** Tipo de projeto (valor do campo no ClickUp; null = não preenchido). */
  tipo: string | null;
  /** Farol do follow-up semanal (null = ainda não avaliado). */
  farol: Farol | null;
  /** Próximo passo combinado no follow-up (campo "PRÓXIMO PASSO", opcional). */
  proximoPasso: string | null;
  /** Data de início do card (plano). ISO. */
  inicioPlan: string;
  /** Data de vencimento do card (plano, como está no ClickUp). ISO. */
  vencimentoPlan: string | null;
  dataLancamentoMeta: string | null;
  inicioRealInformado: string | null;
  conclusaoRealInformada: string | null;
  /** Índice da fase → situação real. */
  real: Record<number, FaseReal>;
  /**
   * Fases que NÃO se aplicam a este projeto (campo "FASES DISPENSADAS" no ClickUp).
   * Somem do planejado e do real; se um bloco inteiro for dispensado, o lead time encolhe.
   */
  dispensadas: number[];
  /** Fases que o card pulou no ClickUp (mudança de status direta) e que não estão marcadas como dispensadas. */
  puladas: number[];
  atualizadoEm: string | null;
}

export interface FaseModelo {
  nome: string;
  /** Cor da fase (igual à do status no ClickUp). */
  cor: string;
  /** Nomes de status do ClickUp que representam esta fase. */
  status: string[];
}

/**
 * Um bloco = uma ou mais fases que correm juntas no mesmo período
 * (as células mescladas da planilha). O prazo é do bloco inteiro.
 */
export interface Bloco {
  /** Índices das fases (em ordem) que compõem o bloco. */
  fases: number[];
  /** Prazo do bloco em dias corridos. */
  dias: number;
}

/** Tipo de projeto (campo "Tipo de Projeto" no ClickUp) com seu próprio lead time. */
export interface TipoProjeto {
  id: string;
  /** Nome como aparece no ClickUp, ex.: "Ampliação de Portfólio". */
  nome: string;
  /** Referência de duração, ex.: "6 a 8 meses". */
  referencia: string;
  /** Meta de lead time total (dias). */
  meta: number;
  blocos: Bloco[];
}

/**
 * Regras do farol automático (campo "Status do Projeto" no ClickUp).
 * - Atrasado: o real já saiu do esperado — fase atual passou do prazo, ou a conclusão
 *   projetada ficou mais de `toleranciaDias` depois da planejada.
 * - Atenção: ainda dentro do plano, mas a fase atual já consumiu `atencaoPct`% do prazo.
 * - No Prazo: o resto.
 */
export interface RegrasFarol {
  /** Liga/desliga a gravação automática no ClickUp. */
  ativo: boolean;
  /** Dias de folga na conclusão antes de virar "Atrasado". */
  toleranciaDias: number;
  /** % do prazo da fase atual a partir do qual vira "Atenção". */
  atencaoPct: number;
}

export interface Modelo {
  versao: 2;
  /** Farol automático (ausente em arquivos antigos → regras padrão). */
  farolAuto?: RegrasFarol;
  fases: FaseModelo[];
  tipos: TipoProjeto[];
  /** Tipo usado quando o card não tem "Tipo de Projeto" preenchido. */
  tipoPadrao: string;
}

export interface RespostaProjetos {
  projetos: Projeto[];
  sincronizadoEm: string;
  origem: 'clickup' | 'cache';
}

export interface StatusLista {
  status: string;
  cor: string;
  tipo: string;
}

/** Categorias de motivo de reprogramação (vão no comentário do card). */
export const MOTIVOS_REPROGRAMACAO = [
  'Atraso em Sourcing',
  'Atraso em amostra / teste',
  'Reprovação em teste',
  'Fornecedor / produção',
  'Logística / importação',
  'Arte / embalagem',
  'Decisão comercial / diretoria',
  'Outro',
] as const;

export interface OpcoesOnda {
  ondas: string[];
  anos: string[];
  /** Campos opcionais de histórico existentes na lista. */
  temOndaOriginal: boolean;
  temContador: boolean;
}

export interface PedidoReprogramacao {
  onda: string;
  ano: string;
  categoria: string;
  motivo: string;
}

/** Um follow-up registrado como comentário no card ("♦️DATA:" / "♦️Comentário:"). */
export interface Followup {
  /** Data escrita no comentário (dd/mm/aaaa). */
  data: string;
  comentario: string;
  por: string | null;
  /** Data e hora em que o comentário foi criado no ClickUp (ISO). */
  em: string | null;
}

/** Uma reprogramação lida dos comentários do card. */
export interface Reprogramacao {
  data: string;
  de: string;
  para: string;
  categoria: string;
  motivo: string;
  por: string | null;
}
