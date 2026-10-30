# Cadastro de produtos

Sistema de cadastro de produtos com API REST (Node.js + Express) e banco SQLite, mais um frontend em HTML/CSS/JS puro servido pela própria API.

Cada produto tem: **nome**, **ID único**, **descrição**, **quantidade**, **valor de compra**, **valor de venda** e **imagem pequena** (miniatura).

## Como rodar

Requisitos: Node.js 22.13 ou mais novo (o banco usa o SQLite embutido no Node, então `npm install` instala só o Express e não compila nada). Confira a versão com `node -v`.

```bash
npm install
npm start
```

Abra http://localhost:3000.

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Inicia o servidor e reinicia sozinho ao salvar um arquivo |
| `npm test` | Roda os testes da API (banco em memória, não mexe nos seus dados) |

Variáveis de ambiente opcionais:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta do servidor |
| `DB_FILE` | `data/produtos.db` | Caminho do arquivo SQLite |

Os dados ficam em `data/produtos.db`. Para zerar o cadastro, pare o servidor e apague a pasta `data/`.

## Estrutura

```
server.js          Inicia o servidor (porta, banco, encerramento limpo)
src/db.js          Abre o SQLite e cria a tabela products
src/validate.js    Regras de validação dos campos
src/app.js         Rotas da API e arquivos estáticos
public/            Frontend (index.html, style.css, app.js)
test/api.test.js   Testes da API
```

## API

Base: `/api/products`. Valores em dinheiro trafegam em reais (ex.: `39.9`) e são guardados em centavos no banco.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/products` | Lista todos. `?q=texto` busca por nome ou ID |
| GET | `/api/products/:id` | Busca um produto |
| POST | `/api/products` | Cria (201) |
| PUT | `/api/products/:id` | Atualiza todos os campos |
| DELETE | `/api/products/:id` | Exclui (204) |

Exemplo de corpo para POST e PUT:

```json
{
  "unique_id": "PRD-001",
  "name": "Caneca térmica 450 ml",
  "description": "Aço inox com tampa rosqueável",
  "quantity": 24,
  "purchase_price": 18.9,
  "sale_price": 39.9,
  "image": ""
}
```

Erros:

- `400` com `{ "errors": { "campo": "mensagem" } }` quando algum campo é inválido.
- `409` com `{ "errors": { "unique_id": "..." } }` quando o ID já existe (a comparação ignora maiúsculas e minúsculas).
- `404` com `{ "error": "..." }` quando o produto não existe.

`image` é um data URI (`data:image/jpeg;base64,...`) ou texto vazio. O frontend reduz a foto para 160 px antes de enviar, então cada imagem ocupa poucos KB no banco.

Teste rápido pelo terminal:

```bash
curl -X POST localhost:3000/api/products \
  -H 'Content-Type: application/json' \
  -d '{"unique_id":"PRD-001","name":"Caneca","quantity":10,"purchase_price":18.9,"sale_price":39.9}'

curl localhost:3000/api/products
```

## Como fazer alterações

**Adicionar um campo novo** (exemplo: `category`):

1. `src/db.js`: adicione a coluna em `CREATE TABLE`. Para um banco que já existe, rode também `ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT ''` (ou apague `data/` se ainda não tem dados importantes).
2. `src/validate.js`: valide o campo e inclua no objeto `value`.
3. `src/app.js`: inclua o campo em `toApi`, no `INSERT` e no `UPDATE`.
4. `public/index.html` e `public/app.js`: adicione o input, leia o valor em `formData()`, preencha em `startEdit()` e mostre em `renderRow()`.
5. `test/api.test.js`: ajuste ou acrescente um teste.

**Mudar o limite de "Estoque baixo"**: constante `LOW_STOCK` no início de `public/app.js`.

**Mudar visual**: cores e fontes estão como variáveis no topo de `public/style.css` (há versão clara e escura automática).

## Observações

- Não há login. Se for publicar na internet, coloque autenticação na frente das rotas `/api` antes de expor.
- As fontes do frontend vêm do Google Fonts; sem internet, a página usa fontes do sistema.
- Em versões do Node abaixo da 24, o `node:sqlite` pode imprimir um aviso "ExperimentalWarning" ao iniciar. É só um aviso e não afeta o funcionamento.
