const os = require('os');
const { spawn } = require('child_process');

const localAddresses = Object.values(os.networkInterfaces())
  .reduce((addresses, networkAddresses) => addresses.concat(networkAddresses || []), [])
  .filter((address) =>
    !address.internal && (address.family === 'IPv4' || address.family === 4)
  )
  .map((address) => address.address);

console.log('\nBudgetApp — servidor Angular de desenvolvimento');
if (localAddresses.length) {
  console.log('Acesso pelo computador: http://localhost:4200');
  console.log('Acesso pela rede local:');
  localAddresses.forEach((address) => {
    console.log(`  http://${address}:4200`);
  });
} else {
  console.log('Nenhum endereço IPv4 de rede local foi encontrado.');
}
console.log('Hot reload ativo. Pressione Ctrl+C para encerrar.\n');

const angularCli = require.resolve('@angular/cli/bin/ng');
const server = spawn(
  process.execPath,
  [angularCli, 'serve', '--host', '0.0.0.0', '--port', '4200', '--live-reload', '--no-open'],
  { stdio: 'inherit' }
);

let stopping = false;
const stopServer = (signal) => {
  if (stopping) return;
  stopping = true;
  if (!server.killed) server.kill(signal);
};

process.on('SIGINT', () => stopServer('SIGINT'));
process.on('SIGTERM', () => stopServer('SIGTERM'));

server.on('error', (error) => {
  console.error('Não foi possível iniciar o servidor Angular:', error.message);
  process.exitCode = 1;
});

server.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code == null ? 1 : code);
});
