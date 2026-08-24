const app = require('./src/app');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');

const server = app.listen(env.port, () => {
  logger.info(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

// Log rather than die silently: an unhandled rejection during a demo should
// leave a trace in the terminal, not just a hung request.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason instanceof Error ? reason.stack : reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception - shutting down', err.stack);
  server.close(() => process.exit(1));
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    logger.info(`${signal} received, closing server`);
    server.close(() => process.exit(0));
  });
}
