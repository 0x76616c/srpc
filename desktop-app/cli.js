const { program } = require('commander');

function setupCLI(server) {
  program
    .command('start')
    .description('Start the RPC server')
    .action(() => server.start());

  program
    .command('log-level <level>')
    .description('Set log level (error, warn, info, debug)')
    .action((level) => {
      if (!['error', 'warn', 'info', 'debug'].includes(level)) {
        console.error(
          'Invalid log level. Must be one of: error, warn, info, debug'
        );
        process.exit(1);
      }
      server.setLogLevel(level);
    });

  program
    .command('auto-start <enabled>')
    .description('Enable or disable auto-start (true/false)')
    .action((enabled) => {
      const value = enabled.toLowerCase();
      if (!['true', 'false'].includes(value)) {
        console.error('Invalid value. Must be true or false');
        process.exit(1);
      }
      server.setAutoStart(value === 'true');
    });

  return program;
}

module.exports = { setupCLI };
