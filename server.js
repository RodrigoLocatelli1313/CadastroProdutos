const path = require('node:path');
const { openDb } = require('./src/db');
const { createApp } = require('./src/app');

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'produtos.db');

const db = openDb(DB_FILE);
const app = createApp(db);

const server = app.listen(PORT, () => {
  console.log(`Cadastro de produtos rodando em http://localhost:${PORT}`);
  console.log(`Banco de dados: ${DB_FILE}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
