const MAX_IMAGE_CHARS = 300_000; // ~220 KB de imagem; o frontend envia ~10 KB

const IMAGE_RE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;

function toCents(value) {
  return Math.round(Number(value) * 100);
}

/**
 * Valida e normaliza o corpo de um produto.
 * Retorna { errors } (objeto campo -> mensagem) ou { value } pronto para o banco.
 */
function validateProduct(body) {
  const errors = {};
  const b = body && typeof body === 'object' ? body : {};

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) errors.name = 'Informe o nome do produto.';
  else if (name.length > 120) errors.name = 'O nome pode ter no máximo 120 caracteres.';

  const uniqueId = typeof b.unique_id === 'string' ? b.unique_id.trim() : '';
  if (!uniqueId) errors.unique_id = 'Informe um ID único.';
  else if (uniqueId.length > 40) errors.unique_id = 'O ID pode ter no máximo 40 caracteres.';

  const description = typeof b.description === 'string' ? b.description.trim() : '';
  if (description.length > 500) errors.description = 'A descrição pode ter no máximo 500 caracteres.';

  const quantity = Number(b.quantity);
  if (b.quantity === '' || b.quantity == null || !Number.isInteger(quantity) || quantity < 0) {
    errors.quantity = 'Use um número inteiro, 0 ou maior.';
  }

  const purchase = Number(b.purchase_price);
  if (b.purchase_price === '' || b.purchase_price == null || !Number.isFinite(purchase) || purchase < 0) {
    errors.purchase_price = 'Informe o valor de compra (0 ou maior).';
  }

  const sale = Number(b.sale_price);
  if (b.sale_price === '' || b.sale_price == null || !Number.isFinite(sale) || sale < 0) {
    errors.sale_price = 'Informe o valor de venda (0 ou maior).';
  }

  const image = typeof b.image === 'string' ? b.image : '';
  if (image && (image.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(image))) {
    errors.image = 'Imagem inválida ou grande demais.';
  }

  if (Object.keys(errors).length) return { errors };

  return {
    value: {
      unique_id: uniqueId,
      name,
      description,
      quantity,
      purchase_cents: toCents(purchase),
      sale_cents: toCents(sale),
      image,
    },
  };
}

module.exports = { validateProduct };
