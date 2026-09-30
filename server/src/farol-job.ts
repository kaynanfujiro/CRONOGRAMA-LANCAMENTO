/**
 * Roda o farol automático uma vez e sai.
 *   npm run farol
 * Útil para agendar no Agendador de Tarefas do Windows (ex.: toda terça às 7h),
 * sem precisar deixar o `npm run dev` aberto.
 */
import { lerModelo } from './modelo-store';
import { lerClickUp } from './leitura';
import { sincronizarFarol } from './farol-sync';
import { validarConfig } from './config';

const erros = validarConfig();
if (erros.length) {
  console.error('Configuração incompleta:\n - ' + erros.join('\n - '));
  process.exit(1);
}
const modelo = lerModelo();
const { tarefas, projetos } = await lerClickUp(modelo);
const rel = await sincronizarFarol(tarefas, projetos, modelo);
if (rel) {
  console.log(`\nFarol: ${rel.avaliados} avaliados · ${rel.alterados} alterados · ${rel.semMudanca} sem mudança · ${rel.ignorados} fora (backlog/concluído/cancelado)`);
  if (rel.aviso) console.log('Aviso: ' + rel.aviso);
}
