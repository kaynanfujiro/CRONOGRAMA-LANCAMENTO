/**
 * Define a senha de edição que vai embutida no projeto: `npm run senha`.
 * Grava só o resumo criptográfico (scrypt) em server/src/acesso.json — a senha em si não fica em lugar nenhum.
 * Depois é só buildar/zipar/subir normalmente: o servidor já sobe com a senha certa.
 */
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { arquivoAcesso } from './config';
import { resumirSenha } from './sessao';

function perguntar(texto: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // não mostra o que é digitado
    const escrever = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.startsWith(texto)) escrever.call(rl, texto);
      else if (s.includes('\n') || s.includes('\r')) escrever.call(rl, '\n');
      else escrever.call(rl, '*');
    };
    rl.question(texto, (r) => {
      rl.close();
      resolve(r.trim());
    });
  });
}

const doArgumento = process.argv[2]?.trim();
const senha = doArgumento || (await perguntar('Nova senha de edição: '));
if (senha.length < 6) {
  console.error('\nA senha precisa ter pelo menos 6 caracteres. Nada foi alterado.');
  process.exit(1);
}
if (!doArgumento && (await perguntar('Repita a senha: ')) !== senha) {
  console.error('\nAs senhas não conferem. Nada foi alterado.');
  process.exit(1);
}
writeFileSync(
  arquivoAcesso,
  JSON.stringify({ aviso: 'Gerado por npm run senha. Contém só o resumo da senha de edição, não a senha.', senhaEdicao: resumirSenha(senha) }, null, 2) + '\n',
);
console.log(`\nSenha de edição salva em ${arquivoAcesso}.`);
console.log('Reinicie o npm run dev e, para o servidor da empresa, gere o build/pacote de novo.');
