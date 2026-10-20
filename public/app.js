const app = document.querySelector('#app');
const resetButton = document.querySelector('#reset-data');
const currentRoute = ['orders', 'settings', 'admin', 'search', 'records'].includes(window.location.pathname.slice(1))
  ? window.location.pathname.slice(1)
  : 'checkout';

let fixtures;

void start();

async function start() {
  wireResetButton();
  try {
    fixtures = await getJson('/api/fixtures');
    if (fixtures.hosted) {
      document.querySelector('#hosted-notice').hidden = false;
      document.querySelector('.footer > span').textContent = 'Hosted walkthrough · short-lived browser-cookie state';
    }
    await render(currentRoute);
  } catch (error) {
    app.innerHTML = renderError('The demo could not load its deterministic fixture data.');
    console.error(error);
  }
}

async function render(route) {
  document.querySelectorAll('[data-route]').forEach((link) => {
    link.classList.toggle('nav-link-active', link.dataset.route === route);
  });

  if (route === 'orders') {
    await renderOrders();
    return;
  }

  if (route === 'settings') {
    await renderSettings();
    return;
  }

  if (route === 'admin') {
    await renderAdmin();
    return;
  }

  if (route === 'search') {
    await renderSearch();
    return;
  }

  if (route === 'records') {
    await renderRecords();
    return;
  }

  renderCheckout();
}

function renderCheckout() {
  const product = fixtures.products.find((item) => item.id === fixtures.checkout.productId);
  const initialQuantity = fixtures.checkout.quantity;
  const initialTotal = product.unitPriceCents * initialQuantity;

  app.innerHTML = `
    <section class="page-intro page-intro-split">
      <div>
        <p class="eyebrow">Proof path / 01</p>
        <h1>Place a known order.</h1>
        <p class="lede">A small checkout with fixed inputs, fixed prices, and a visible business outcome.</p>
      </div>
      <div class="fixture-badge">
        <span class="fixture-dot" aria-hidden="true"></span>
        <span>Fixture <strong>${escapeHtml(fixtures.dataVersion)}</strong></span>
      </div>
    </section>

    <section class="content-grid" aria-label="Checkout workspace">
      <article class="card checkout-card">
        <div class="card-header">
          <div>
            <p class="card-kicker">Deterministic cart</p>
            <h2>Checkout</h2>
          </div>
          <span class="card-index">01</span>
        </div>

        <div class="product-line">
          <div class="product-mark" aria-hidden="true">TG</div>
          <div class="product-copy">
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.description)}</p>
          </div>
          <strong class="product-price">${formatCurrency(product.unitPriceCents)}</strong>
        </div>

        <form id="checkout-form" class="checkout-form">
          <div class="field">
            <label for="customer-name">Customer name</label>
            <input id="customer-name" name="customerName" type="text" value="${escapeHtml(fixtures.checkout.customerName)}" readonly />
          </div>
          <div class="field">
            <label for="quantity">Quantity for ${escapeHtml(product.name)}</label>
            <input id="quantity" name="quantity" type="number" min="1" max="10" value="${initialQuantity}" required />
          </div>
          <div class="order-total-preview">
            <span>Expected total</span>
            <strong id="expected-total">${formatCurrency(initialTotal)}</strong>
          </div>
          <button class="button button-primary" type="submit">Place order</button>
          <div id="checkout-status" class="inline-status" role="status" aria-live="polite" hidden></div>
        </form>
      </article>

      <aside class="proof-panel">
        <p class="card-kicker">Why this screen exists</p>
        <h2>The confirmation is not the proof.</h2>
        <p>Phase 1 gives us a deliberately small flow so the tests can separate a success message from a persisted order.</p>
        <div class="proof-list">
          <div class="proof-item"><span class="proof-number">A</span><span>Place the fixture order.</span></div>
          <div class="proof-item"><span class="proof-number">B</span><span>Open order history.</span></div>
          <div class="proof-item"><span class="proof-number">C</span><span>Verify line items and total.</span></div>
        </div>
      </aside>
    </section>
  `;

  const quantityInput = document.querySelector('#quantity');
  const expectedTotal = document.querySelector('#expected-total');
  quantityInput.addEventListener('input', () => {
    const quantity = Number(quantityInput.value);
    expectedTotal.textContent = Number.isInteger(quantity) && quantity > 0
      ? formatCurrency(product.unitPriceCents * quantity)
      : '—';
  });

  document.querySelector('#checkout-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    const status = document.querySelector('#checkout-status');
    const quantity = Number(quantityInput.value);

    submitButton.disabled = true;
    submitButton.textContent = 'Saving order…';
    status.hidden = true;

    try {
      const result = await postJson('/api/orders', {
        customerName: fixtures.checkout.customerName,
        productId: product.id,
        quantity,
      });
      status.className = 'inline-status inline-status-success';
      status.textContent = `Order confirmed · ${result.order.id}`;
      status.hidden = false;
    } catch (error) {
      status.className = 'inline-status inline-status-error';
      status.textContent = error instanceof Error ? error.message : 'The order could not be saved.';
      status.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Place order';
    }
  });
}

async function renderOrders() {
  let orders;
  try {
    orders = (await getJson('/api/orders')).orders;
  } catch (error) {
    app.innerHTML = renderError('Order history could not be loaded.');
    console.error(error);
    return;
  }

  app.innerHTML = `
    <section class="page-intro page-intro-split">
      <div>
        <p class="eyebrow">Proof path / 02</p>
        <h1>Order history.</h1>
        <p class="lede">The durable-looking screen that turns a checkout confirmation into a business-outcome check.</p>
      </div>
      <div class="history-summary">
        <span class="summary-number">${orders.length}</span>
        <span>${orders.length === 1 ? 'order recorded' : 'orders recorded'}</span>
      </div>
    </section>

    <section class="card history-card" aria-labelledby="orders-heading">
      <div class="card-header">
        <div>
          <p class="card-kicker">Persisted state</p>
          <h2 id="orders-heading">Orders</h2>
        </div>
        <span class="card-index">02</span>
      </div>
      ${orders.length === 0 ? renderEmptyHistory() : renderOrderList(orders)}
    </section>
  `;
}

async function renderSettings() {
  const { profile } = await getJson('/api/profile');
  app.innerHTML = `
    <section class="page-intro">
      <p class="eyebrow">Proof path / 03</p>
      <h1>Profile settings.</h1>
      <p class="lede">A save flow that must survive a reload, not just show a green response.</p>
    </section>
    <section class="card narrow-card">
      <div class="card-header"><div><p class="card-kicker">Saved state</p><h2>Preferences</h2></div><span class="card-index">03</span></div>
      <form id="profile-form" class="checkout-form">
        <div class="field"><label for="preferred-name">Preferred name</label><input id="preferred-name" value="${escapeHtml(profile.preferredName)}" required /></div>
        <p class="helper-copy">The strong settings test saves this value, reloads, and reads it back.</p>
        <button class="button button-primary" type="submit">Save preference</button>
        <div id="profile-status" class="inline-status" role="status" hidden></div>
      </form>
    </section>
  `;

  document.querySelector('#profile-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.querySelector('#profile-status');
    try {
      const result = await patchJson('/api/profile', { preferredName: document.querySelector('#preferred-name').value });
      status.className = 'inline-status inline-status-success';
      status.textContent = `Saved as ${result.profile.preferredName}`;
      status.hidden = false;
    } catch (error) {
      status.className = 'inline-status inline-status-error';
      status.textContent = error instanceof Error ? error.message : 'The preference could not be saved.';
      status.hidden = false;
    }
  });
}

async function renderAdmin() {
  app.innerHTML = `
    <section class="page-intro"><p class="eyebrow">Proof path / 04</p><h1>Protected summary.</h1><p class="lede">A normal fixture user should not be able to cross this boundary.</p></section>
    <section class="card narrow-card"><div class="card-header"><div><p class="card-kicker">Authorization</p><h2>Admin area</h2></div><span class="card-index">04</span></div><div id="admin-result" class="empty-state"><p>Checking access…</p></div></section>
  `;
  const result = document.querySelector('#admin-result');
  try {
    const payload = await getJson('/api/admin/summary');
    result.innerHTML = `<h3>Access granted</h3><p>${escapeHtml(payload.summary)}</p>`;
  } catch (error) {
    result.innerHTML = `<h3>Access denied</h3><p>${escapeHtml(error instanceof Error ? error.message : 'Forbidden')}</p>`;
  }
}

async function renderSearch() {
  app.innerHTML = `
    <section class="page-intro"><p class="eyebrow">Proof path / 05</p><h1>Search the catalog.</h1><p class="lede">The result set itself is the assertion. A visible container is not enough.</p></section>
    <section class="card"><div class="card-header"><div><p class="card-kicker">Expected result set</p><h2>Fixture search</h2></div><span class="card-index">05</span></div><form id="search-form" class="search-form"><label for="search-query">Search query</label><input id="search-query" value="pen" /><button class="button button-primary" type="submit">Search</button></form><div id="search-results" class="search-results" role="list" aria-label="Search results"></div></section>
  `;
  const runSearch = async () => {
    const query = document.querySelector('#search-query').value;
    const payload = await getJson(`/api/products/search?q=${encodeURIComponent(query)}`);
    document.querySelector('#search-results').innerHTML = payload.products.length === 0
      ? '<div class="empty-state"><h3>No matching products.</h3></div>'
      : payload.products.map((product) => `<div class="search-result" role="listitem"><strong>${escapeHtml(product.name)}</strong><span>${formatCurrency(product.unitPriceCents)}</span></div>`).join('');
  };
  document.querySelector('#search-form').addEventListener('submit', async (event) => { event.preventDefault(); await runSearch(); });
  await runSearch();
}

async function renderRecords() {
  const { records } = await getJson('/api/records');
  app.innerHTML = `
    <section class="page-intro"><p class="eyebrow">Proof path / 06</p><h1>Record isolation.</h1><p class="lede">Update one record and confirm its neighbors remain untouched.</p></section>
    <section class="card"><div class="card-header"><div><p class="card-kicker">Stable IDs</p><h2>Managed records</h2></div><span class="card-index">06</span></div><div class="record-list">${records.map((record) => `<div class="record-row" data-record-id="${record.id}"><div><strong>${escapeHtml(record.id)}</strong><span>${escapeHtml(record.label)}</span></div><select aria-label="Status for ${escapeHtml(record.id)}"><option ${record.status === 'ready' ? 'selected' : ''}>ready</option><option ${record.status === 'queued' ? 'selected' : ''}>queued</option><option ${record.status === 'archived' ? 'selected' : ''}>archived</option></select><button class="button button-secondary" type="button">Update</button></div>`).join('')}</div><div id="record-status" class="inline-status" role="status" hidden></div></section>
  `;
  document.querySelectorAll('.record-row button').forEach((button) => button.addEventListener('click', async () => {
    const row = button.closest('.record-row');
    const payload = await patchJson(`/api/records/${row.dataset.recordId}`, { status: row.querySelector('select').value });
    const status = document.querySelector('#record-status');
    status.className = 'inline-status inline-status-success';
    status.textContent = `Updated ${payload.selectedRecordId}`;
    status.hidden = false;
  }));
}

function renderOrderList(orders) {
  return `
    <ul class="orders-list" role="list" aria-label="Orders">
      ${orders.map((order) => `
        <li class="order-row">
          <div class="order-main">
            <div class="order-id">${escapeHtml(order.id)}</div>
            <h3>${escapeHtml(order.lineItems[0].productName)}</h3>
            <p>${order.lineItems[0].quantity} × ${formatCurrency(order.lineItems[0].unitPriceCents)} · ${escapeHtml(order.customerName)}</p>
          </div>
          <div class="order-total">
            <span>Total</span>
            <strong data-testid="order-total">${formatCurrency(order.totalCents)}</strong>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderEmptyHistory() {
  return `
    <div class="empty-state" role="status">
      <span class="empty-mark" aria-hidden="true">—</span>
      <h3>No orders yet.</h3>
      <p>Place the deterministic checkout order to create the first record.</p>
      <a class="button button-secondary" href="/checkout">Go to checkout</a>
    </div>
  `;
}

function renderError(message) {
  return `
    <section class="card error-state" role="alert">
      <p class="card-kicker">Demo unavailable</p>
      <h1>Something needs attention.</h1>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}

function wireResetButton() {
  resetButton.addEventListener('click', async () => {
    resetButton.disabled = true;
    resetButton.textContent = 'Resetting…';
    try {
      await postJson('/api/reset', {});
      await render(currentRoute);
      showToast('Demo data reset.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Reset failed.', true);
    } finally {
      resetButton.disabled = false;
      resetButton.textContent = 'Reset demo data';
    }
  });
}

function showToast(message, isError = false) {
  let toast = document.querySelector('#global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
  toast.textContent = message;
  window.setTimeout(() => toast.remove(), 2600);
}

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  return readResponse(response);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return readResponse(response);
}

async function patchJson(url, body) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return readResponse(response);
}

async function readResponse(response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? 'The request failed.');
  }
  return payload;
}

function formatCurrency(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
