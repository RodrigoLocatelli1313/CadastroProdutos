(function () {
  'use strict';

  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var $ = function (id) { return document.getElementById(id); };
  var FIELD_ERRORS = ['name', 'unique_id', 'description', 'quantity', 'purchase_price', 'sale_price', 'image'];
  var LOW_STOCK = 5; // quantidade a partir da qual aparece "Estoque baixo"

  var state = { items: [], editing: null, image: '', query: '', confirmDel: null, loaded: false };

  /* ---------- utilidades ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2800);
  }
  function safeImg(s) { return typeof s === 'string' && s.indexOf('data:image/') === 0 ? s : ''; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  /* ---------- API ---------- */
  function api(method, url, body) {
    return fetch(url, {
      method: method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (res) {
      if (res.status === 204) return null;
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { var err = new Error(data.error || 'Erro ' + res.status); err.fields = data.errors || null; throw err; }
        return data;
      });
    });
  }
  function loadProducts() {
    return api('GET', '/api/products').then(function (items) {
      state.items = items; state.loaded = true; render();
    }).catch(function () {
      state.loaded = true; render(); toast('Não foi possível carregar os produtos.');
    });
  }

  /* ---------- formulário ---------- */
  function clearErrors() { FIELD_ERRORS.forEach(function (k) { $('err-' + k).textContent = ''; }); }
  function showErrors(fields) {
    clearErrors();
    for (var k in fields) { var el = $('err-' + k); if (el) el.textContent = fields[k]; }
  }
  function updateMargin() {
    var c = $('compra').value, v = $('venda').value, m = $('margin');
    if (c === '' || v === '') { m.hidden = true; return; }
    var diff = num(v) - num(c), pct = num(c) > 0 ? (diff / num(c)) * 100 : null;
    m.hidden = false;
    m.className = 'margin-line' + (diff < 0 ? ' neg' : '');
    m.textContent = 'Lucro por unidade: ' + brl.format(diff) + (pct !== null ? ' (' + pct.toFixed(1).replace('.', ',') + '% sobre o custo)' : '');
  }
  function setImage(src) {
    state.image = src;
    var p = $('prev'); p.textContent = '';
    if (src) p.appendChild(h('img', { src: src, alt: 'Pré-visualização da imagem' }));
    else p.textContent = 'sem imagem';
    $('rmimg').hidden = !src;
  }
  function resetForm() {
    state.editing = null;
    $('form').reset(); clearErrors(); setImage(''); updateMargin();
    $('form-title').textContent = 'Novo produto';
    $('save').textContent = 'Cadastrar produto';
    $('cancel').hidden = true;
  }
  function startEdit(p) {
    state.editing = p.id;
    $('nome').value = p.name || ''; $('uid').value = p.unique_id || ''; $('desc').value = p.description || '';
    $('qtd').value = p.quantity; $('compra').value = p.purchase_price; $('venda').value = p.sale_price;
    setImage(safeImg(p.image)); clearErrors(); updateMargin();
    $('form-title').textContent = 'Editando produto';
    $('save').textContent = 'Salvar alterações';
    $('cancel').hidden = false;
    $('nome').focus();
    $('form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function genId() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return 'PRD-' + s;
  }
  // Reduz a imagem escolhida para no máximo 160 px e devolve um data URI JPEG.
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = reject;
      fr.onload = function () {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          var max = 160, s = Math.min(1, max / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * s)), hh = Math.max(1, Math.round(img.height * s));
          var cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
          var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, hh); cx.drawImage(img, 0, 0, w, hh);
          resolve(cv.toDataURL('image/jpeg', 0.8));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function formData() {
    return {
      name: $('nome').value, unique_id: $('uid').value, description: $('desc').value,
      quantity: $('qtd').value, purchase_price: $('compra').value, sale_price: $('venda').value,
      image: state.image
    };
  }
  function submit(e) {
    e.preventDefault(); clearErrors();
    var wasEdit = state.editing !== null;
    var req = wasEdit ? api('PUT', '/api/products/' + state.editing, formData()) : api('POST', '/api/products', formData());
    $('save').disabled = true;
    req.then(function () {
      toast(wasEdit ? 'Produto atualizado.' : 'Produto cadastrado.');
      resetForm();
      return loadProducts();
    }).catch(function (err) {
      if (err.fields) showErrors(err.fields); else toast(err.message);
    }).then(function () { $('save').disabled = false; });
  }

  /* ---------- lista ---------- */
  function renderSummary() {
    var s = $('summary'); s.textContent = '';
    var units = 0, cost = 0, sale = 0;
    state.items.forEach(function (p) {
      units += num(p.quantity); cost += num(p.quantity) * num(p.purchase_price); sale += num(p.quantity) * num(p.sale_price);
    });
    [['Produtos', String(state.items.length)], ['Unidades em estoque', String(units)], ['Estoque a custo', brl.format(cost)],
     ['Estoque a preço de venda', brl.format(sale)], ['Lucro potencial', brl.format(sale - cost)]]
      .forEach(function (p) { s.appendChild(h('div', null, h('span', { class: 'k', text: p[0] }), h('span', { class: 'v', text: p[1] }))); });
  }
  function cell(label, valueEl, extra) {
    return h('div', { class: 'cell' }, h('span', { class: 'lbl', text: label }), valueEl, extra || null);
  }
  function renderRow(p) {
    var thumb = h('div', { class: 'thumb' });
    var src = safeImg(p.image);
    if (src) thumb.appendChild(h('img', { src: src, alt: 'Imagem de ' + (p.name || 'produto') }));
    else thumb.textContent = (p.name || '?').trim().charAt(0).toUpperCase();
    var q = num(p.quantity), c = num(p.purchase_price), v = num(p.sale_price), diff = v - c;
    var qExtra = q === 0 ? h('span', { class: 'pill zero', text: 'Sem estoque' }) : (q <= LOW_STOCK ? h('span', { class: 'pill', text: 'Estoque baixo' }) : null);
    var pct = c > 0 ? (diff / c * 100).toFixed(1).replace('.', ',') + '%' : '—';
    var mg = h('span', { class: 'mg' + (diff < 0 ? ' neg' : ''), text: 'margem ' + pct });
    var actions = h('div', { class: 'row-actions' });
    if (state.confirmDel === p.id) {
      actions.appendChild(h('button', { type: 'button', class: 'small danger', text: 'Confirmar exclusão', onclick: function () {
        state.confirmDel = null;
        api('DELETE', '/api/products/' + p.id).then(function () {
          toast('Produto excluído.'); if (state.editing === p.id) resetForm(); return loadProducts();
        }).catch(function (err) { toast(err.message); loadProducts(); });
      } }));
      actions.appendChild(h('button', { type: 'button', class: 'small', text: 'Voltar', onclick: function () { state.confirmDel = null; render(); } }));
    } else {
      actions.appendChild(h('button', { type: 'button', class: 'small', text: 'Editar', onclick: function () { startEdit(p); } }));
      actions.appendChild(h('button', { type: 'button', class: 'small danger', text: 'Excluir', onclick: function () { state.confirmDel = p.id; render(); } }));
    }
    return h('div', { class: 'row' },
      thumb,
      h('div', { class: 'name' }, h('strong', { text: p.name || '(sem nome)' }), p.description ? h('span', { class: 'desc', text: p.description }) : null, h('span', { class: 'uid', text: p.unique_id || '—' })),
      h('div', { class: 'nums' },
        cell('Qtd.', h('span', { class: 'val', text: String(q) }), qExtra),
        cell('Compra', h('span', { class: 'val', text: brl.format(c) })),
        cell('Venda', h('span', { class: 'val', text: brl.format(v) }), mg)
      ),
      actions
    );
  }
  function render() {
    renderSummary();
    var list = $('list'); list.textContent = '';
    if (!state.loaded) { list.appendChild(h('div', { class: 'empty' }, h('p', { text: 'Carregando produtos…' }))); return; }
    var qs = state.query.trim().toLowerCase();
    var shown = state.items.filter(function (p) {
      return !qs || String(p.name || '').toLowerCase().indexOf(qs) >= 0 || String(p.unique_id || '').toLowerCase().indexOf(qs) >= 0;
    });
    if (!state.items.length) {
      list.appendChild(h('div', { class: 'empty' },
        h('p', { text: 'Nenhum produto cadastrado ainda. Preencha a ficha ao lado para registrar o primeiro item.' }),
        h('button', { type: 'button', text: 'Carregar 3 exemplos', onclick: loadSamples })
      ));
      return;
    }
    if (!shown.length) { list.appendChild(h('div', { class: 'empty' }, h('p', { text: 'Nenhum produto encontrado para essa busca.' }))); return; }
    shown.forEach(function (p) { list.appendChild(renderRow(p)); });
  }
  function loadSamples() {
    var samples = [
      { name: 'Caneca térmica 450 ml', unique_id: 'EX-CAN-450', description: 'Aço inox com tampa rosqueável. Exemplo de cadastro.', quantity: 24, purchase_price: 18.9, sale_price: 39.9, image: '' },
      { name: 'Mochila notebook 15"', unique_id: 'EX-MOC-015', description: 'Poliéster resistente à água, 3 compartimentos. Exemplo de cadastro.', quantity: 4, purchase_price: 62, sale_price: 129.9, image: '' },
      { name: 'Cabo USB-C 1 m', unique_id: 'EX-USB-C1M', description: 'Carga rápida e dados. Exemplo de cadastro.', quantity: 0, purchase_price: 7.5, sale_price: 24.9, image: '' }
    ];
    Promise.all(samples.map(function (s) { return api('POST', '/api/products', s); }))
      .then(function () { toast('Exemplos carregados. Você pode editá-los ou excluí-los.'); return loadProducts(); })
      .catch(function (err) { toast(err.message); loadProducts(); });
  }

  /* ---------- eventos ---------- */
  $('form').addEventListener('submit', submit);
  $('gen').addEventListener('click', function () { $('uid').value = genId(); $('err-unique_id').textContent = ''; });
  $('cancel').addEventListener('click', resetForm);
  $('compra').addEventListener('input', updateMargin);
  $('venda').addEventListener('input', updateMargin);
  $('rmimg').addEventListener('click', function () { $('img').value = ''; setImage(''); });
  $('img').addEventListener('change', function (ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    shrink(f).then(setImage).catch(function () { toast('Não foi possível ler essa imagem.'); });
  });
  $('q').addEventListener('input', function (ev) { state.query = ev.target.value; render(); });

  render();
  loadProducts();
})();
