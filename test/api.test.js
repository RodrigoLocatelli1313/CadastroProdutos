const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');

let db, server, base;

before(async () => {
  db = openDb(':memory:');
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
});

beforeEach(() => {
  db.exec('DELETE FROM products');
});

const sample = (over = {}) => ({
  unique_id: 'PRD-001',
  name: 'Caneca térmica',
  description: 'Aço inox',
  quantity: 10,
  purchase_price: 18.9,
  sale_price: 39.9,
  image: '',
  ...over,
});

const call = (method, path, body) =>
  fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test('cria e lista produtos, convertendo centavos em reais', async () => {
  const res = await call('POST', '/api/products', sample());
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.purchase_price, 18.9);
  assert.equal(created.sale_price, 39.9);

  const list = await (await call('GET', '/api/products')).json();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Caneca térmica');
});

test('rejeita campos inválidos com 400 e mensagens por campo', async () => {
  const res = await call('POST', '/api/products', sample({ name: '', quantity: -1, sale_price: 'abc' }));
  assert.equal(res.status, 400);
  const { errors } = await res.json();
  assert.ok(errors.name && errors.quantity && errors.sale_price);
});

test('ID único não aceita repetição, ignorando maiúsculas', async () => {
  await call('POST', '/api/products', sample());
  const res = await call('POST', '/api/products', sample({ unique_id: 'prd-001', name: 'Outro' }));
  assert.equal(res.status, 409);
  assert.ok((await res.json()).errors.unique_id);
});

test('atualiza um produto e mantém o próprio ID sem conflito', async () => {
  const { id } = await (await call('POST', '/api/products', sample())).json();
  const res = await call('PUT', `/api/products/${id}`, sample({ name: 'Caneca 450 ml', quantity: 3 }));
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.name, 'Caneca 450 ml');
  assert.equal(updated.quantity, 3);
});

test('atualizar para o ID de outro produto retorna 409', async () => {
  await call('POST', '/api/products', sample());
  const b = await (await call('POST', '/api/products', sample({ unique_id: 'PRD-002', name: 'B' }))).json();
  const res = await call('PUT', `/api/products/${b.id}`, sample({ unique_id: 'PRD-001', name: 'B' }));
  assert.equal(res.status, 409);
});

test('exclui e depois retorna 404', async () => {
  const { id } = await (await call('POST', '/api/products', sample())).json();
  assert.equal((await call('DELETE', `/api/products/${id}`)).status, 204);
  assert.equal((await call('GET', `/api/products/${id}`)).status, 404);
  assert.equal((await call('DELETE', `/api/products/${id}`)).status, 404);
});

test('busca por nome ou ID com ?q=', async () => {
  await call('POST', '/api/products', sample());
  await call('POST', '/api/products', sample({ unique_id: 'USB-9', name: 'Cabo USB-C' }));
  const byName = await (await call('GET', '/api/products?q=cabo')).json();
  assert.deepEqual(byName.map((p) => p.unique_id), ['USB-9']);
  const byId = await (await call('GET', '/api/products?q=prd')).json();
  assert.deepEqual(byId.map((p) => p.unique_id), ['PRD-001']);
});

test('valida o formato da imagem', async () => {
  const bad = await call('POST', '/api/products', sample({ image: 'http://exemplo.com/x.png' }));
  assert.equal(bad.status, 400);
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const ok = await call('POST', '/api/products', sample({ image: png }));
  assert.equal(ok.status, 201);
});

test('JSON inválido retorna 400', async () => {
  const res = await fetch(base + '/api/products', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{quebrado',
  });
  assert.equal(res.status, 400);
});
