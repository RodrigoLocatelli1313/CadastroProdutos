const path = require('node:path');
const express = require('express');
const { validateProduct } = require('./validate');

/** Converte uma linha do banco (centavos) para o formato da API (reais). */
function toApi(row) {
  return {
    id: row.id,
    unique_id: row.unique_id,
    name: row.name,
    description: row.description,
    quantity: row.quantity,
    purchase_price: row.purchase_cents / 100,
    sale_price: row.sale_cents / 100,
    image: row.image,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const listAll = db.prepare('SELECT * FROM products ORDER BY name COLLATE NOCASE');
  const search = db.prepare(`
    SELECT * FROM products
    WHERE name LIKE @q ESCAPE '\\' OR unique_id LIKE @q ESCAPE '\\'
    ORDER BY name COLLATE NOCASE
  `);
  const getOne = db.prepare('SELECT * FROM products WHERE id = ?');
  const insert = db.prepare(`
    INSERT INTO products (unique_id, name, description, quantity, purchase_cents, sale_cents, image)
    VALUES (@unique_id, @name, @description, @quantity, @purchase_cents, @sale_cents, @image)
  `);
  const update = db.prepare(`
    UPDATE products SET
      unique_id = @unique_id, name = @name, description = @description, quantity = @quantity,
      purchase_cents = @purchase_cents, sale_cents = @sale_cents, image = @image,
      updated_at = datetime('now')
    WHERE id = @id
  `);
  const remove = db.prepare('DELETE FROM products WHERE id = ?');

  // node:sqlite: errcode 2067 = SQLITE_CONSTRAINT_UNIQUE (a mensagem é o plano B)
  const isDuplicate = (err) =>
    !!err && (err.errcode === 2067 || /UNIQUE constraint failed/i.test(String(err.message)));
  const dupResponse = (res) =>
    res.status(409).json({ errors: { unique_id: 'Este ID já está em uso por outro produto.' } });

  // Listar (com busca opcional ?q=)
  app.get('/api/products', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rows = q
      ? search.all({ q: `%${q.replace(/[\\%_]/g, '\\$&')}%` })
      : listAll.all();
    res.json(rows.map(toApi));
  });

  // Buscar um
  app.get('/api/products/:id', (req, res) => {
    const row = getOne.get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json(toApi(row));
  });

  // Criar
  app.post('/api/products', (req, res) => {
    const { errors, value } = validateProduct(req.body);
    if (errors) return res.status(400).json({ errors });
    try {
      const info = insert.run(value);
      res.status(201).json(toApi(getOne.get(info.lastInsertRowid)));
    } catch (err) {
      if (isDuplicate(err)) return dupResponse(res);
      throw err;
    }
  });

  // Atualizar (substitui todos os campos)
  app.put('/api/products/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!getOne.get(id)) return res.status(404).json({ error: 'Produto não encontrado.' });
    const { errors, value } = validateProduct(req.body);
    if (errors) return res.status(400).json({ errors });
    try {
      update.run({ ...value, id });
      res.json(toApi(getOne.get(id)));
    } catch (err) {
      if (isDuplicate(err)) return dupResponse(res);
      throw err;
    }
  });

  // Excluir
  app.delete('/api/products/:id', (req, res) => {
    const info = remove.run(Number(req.params.id));
    if (!info.changes) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.status(204).end();
  });

  // Frontend estático
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // 404 para rotas /api desconhecidas
  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

  // Tratamento de erros (JSON inválido, falhas inesperadas)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Requisição grande demais.' });
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  });

  return app;
}

module.exports = { createApp };
