import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../../api/demo.js';

type Request = Parameters<typeof handler>[0];
type Response = Parameters<typeof handler>[1];

const cookieName = 'trenguard_demo_state';
const cookieAttributes = '; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600';
const checkout = { customerName: 'Ada Lovelace', productId: 'proofforge-notebook', quantity: 2 };
const initialProfile = { customerName: 'Ada Lovelace', email: 'ada@example.test', preferredName: 'Ada' };
const initialRecords = [
  { id: 'record-001', label: 'Verification corpus', status: 'ready' },
  { id: 'record-002', label: 'Checkout journey', status: 'queued' },
  { id: 'record-003', label: 'Replay safety notes', status: 'archived' },
];

function expectedOrder(id = 'order-0001', customerName = checkout.customerName) {
  return {
    id,
    customerName,
    lineItems: [{
      productId: 'proofforge-notebook',
      productName: 'TrenGuard Notebook',
      quantity: 2,
      unitPriceCents: 1299,
      lineTotalCents: 2598,
    }],
    totalCents: 2598,
  };
}

function validState() {
  return { orders: [expectedOrder()], profile: { ...initialProfile }, records: structuredClone(initialRecords) };
}

interface ApiResult {
  statusCode: number;
  headers: Map<string, string | string[]>;
  body: Record<string, unknown>;
}

async function invoke(request: Request): Promise<ApiResult> {
  const statusCalls: number[] = [];
  const headers = new Map<string, string | string[]>();
  let payload: unknown;
  let jsonCalls = 0;
  const response: Response = {
    status(code) {
      statusCalls.push(code);
      return response;
    },
    setHeader(name, value) {
      assert.equal(jsonCalls, 0, 'headers must be sent before the body');
      headers.set(name.toLowerCase(), value);
      return response;
    },
    json(value) {
      jsonCalls += 1;
      payload = JSON.parse(JSON.stringify(value)) as unknown;
    },
  };
  await handler(request, response);
  assert.equal(jsonCalls, 1, 'each request must finish with exactly one JSON response');
  assert.equal(statusCalls.length, 1, 'do not return success before detecting overflow');
  const statusCode = statusCalls[0];
  assert.equal(typeof statusCode, 'number');
  assert.ok(payload && typeof payload === 'object' && !Array.isArray(payload));
  assert.equal(headers.get('cache-control'), 'no-store');
  const cookie = headers.get('set-cookie');
  if (cookie !== undefined) {
    assert.equal(typeof cookie, 'string');
    assertCookie(cookie as string);
  }
  return { statusCode: statusCode as number, headers, body: payload as Record<string, unknown> };
}

// Each jar only sends cookies issued to it. A new jar with the same cookie models
// a reload/new request; a new empty jar models another browser or cleared data.
class CookieJar {
  public cookie: string | undefined;

  public constructor(cookie?: string) {
    this.cookie = cookie;
  }

  public async request(url: string, method = 'GET', body?: unknown): Promise<ApiResult> {
    const result = await invoke({ url, method, body, headers: { cookie: this.cookie } });
    const setCookie = result.headers.get('set-cookie');
    if (typeof setCookie === 'string') this.cookie = setCookie.split(';')[0];
    return result;
  }
}

function assertCookie(cookie: string): void {
  assert.ok(Buffer.byteLength(cookie, 'utf8') <= 3800, 'full Set-Cookie must stay safely below 4096 bytes');
  const [pair, ...attributes] = cookie.split('; ');
  assert.match(pair ?? '', /^trenguard_demo_state=[A-Za-z0-9_-]+$/);
  assert.deepEqual(new Set(attributes), new Set(['Path=/', 'Secure', 'HttpOnly', 'SameSite=Lax', 'Max-Age=3600']));
}

function cookieFor(value: unknown): string {
  return `${cookieName}=${Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')}`;
}

function assertError(result: ApiResult, status: number, error: string): void {
  assert.equal(result.statusCode, status);
  assert.equal(result.body.error, error);
  assert.equal(result.headers.has('set-cookie'), false, 'rejection must preserve the previous browser cookie');
  assert.equal(result.body.order, undefined);
  assert.equal(result.body.saved, undefined);
}

function assertResetError(result: ApiResult, error = 'INVALID_DEMO_STATE'): void {
  assertError(result, 409, error);
  assert.equal(typeof result.body.message, 'string');
  assert.match(result.body.message as string, /reset the demo/i);
  assert.match(result.body.message as string, /POST \/api\/reset/);
}

async function assertInitialState(jar: CookieJar): Promise<void> {
  const orders = await jar.request('/api/orders');
  const profile = await jar.request('/api/profile');
  const records = await jar.request('/api/records');
  assert.equal(orders.statusCode, 200);
  assert.equal(profile.statusCode, 200);
  assert.equal(records.statusCode, 200);
  assert.deepEqual(orders.body, { orders: [] });
  assert.deepEqual(profile.body, { profile: initialProfile });
  assert.deepEqual(records.body, { records: initialRecords });
}

test('health aliases and fixtures explicitly identify the hosted cookie demo', async () => {
  const jar = new CookieJar(`${cookieName}=broken`);
  for (const route of ['/health', '/api/health', '/api/fixtures']) {
    const result = await jar.request(route);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.hosted, true);
    assert.equal(result.body.persistence, 'browser-cookie-demo-state');
    assert.equal(result.body.dataVersion, 'phase-1-v1');
    assert.equal(result.headers.has('set-cookie'), false);
    if (route === '/api/fixtures') {
      assert.deepEqual(result.body.checkout, checkout);
      assert.deepEqual(result.body.mutation, { id: null, marker: 'HEALTHY_BASELINE' });
      assert.ok(Array.isArray(result.body.products));
      assert.equal(result.body.products.length, 2);
    } else {
      assert.equal(result.body.status, 'ok');
      assert.equal(result.body.mutationId, null);
      assert.equal(result.body.mutationMarker, 'HEALTHY_BASELINE');
    }
  }
});

test('checkout returns exactly $25.98 and survives repeated reloads without duplicate orders', async () => {
  const browser = new CookieJar();
  await assertInitialState(browser);
  const created = await browser.request('/api/orders', 'POST', checkout);
  assert.equal(created.statusCode, 201);
  assert.deepEqual(created.body, { order: expectedOrder() });
  assert.ok(browser.cookie);

  const reloaded = new CookieJar(browser.cookie);
  for (let reload = 0; reload < 2; reload += 1) {
    const result = await reloaded.request('/api/orders');
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, { orders: [expectedOrder()] });
    assert.equal(result.headers.has('set-cookie'), false);
  }
  const second = await reloaded.request('/api/orders', 'POST', JSON.stringify(checkout));
  assert.equal(second.statusCode, 201);
  assert.deepEqual(second.body, { order: expectedOrder('order-0002') });
  assert.deepEqual((await new CookieJar(reloaded.cookie).request('/api/orders')).body.orders,
    [expectedOrder(), expectedOrder('order-0002')]);
});

test('JSON buffers, known alternative products, and quantity/name boundaries round-trip', async () => {
  const jar = new CookieJar();
  for (const quantity of [1, 10]) {
    const customerName = quantity === 1 ? 'A' : '界'.repeat(80);
    const result = await jar.request('/api/orders', 'POST', Buffer.from(JSON.stringify({
      customerName, productId: 'verification-pen', quantity,
    })));
    assert.equal(result.statusCode, 201);
    assert.deepEqual(result.body.order, {
      id: quantity === 1 ? 'order-0001' : 'order-0002', customerName,
      lineItems: [{ productId: 'verification-pen', productName: 'Verification Pen', quantity, unitPriceCents: 499, lineTotalCents: 499 * quantity }],
      totalCents: 499 * quantity,
    });
  }
  assert.equal((await new CookieJar(jar.cookie).request('/api/orders')).statusCode, 200);
});

test('separate browser jars isolate orders, profile changes, records, and reset', async () => {
  const first = new CookieJar();
  const second = new CookieJar();
  await first.request('/api/orders', 'POST', checkout);
  await first.request('/api/profile', 'PATCH', { preferredName: 'Ada Verified' });
  await first.request('/api/records/record-002', 'PATCH', { status: 'ready' });
  await assertInitialState(second);

  const created = await second.request('/api/orders', 'POST', { ...checkout, customerName: ' Grace Hopper ' });
  assert.equal(created.statusCode, 201);
  assert.deepEqual(created.body.order, expectedOrder('order-0001', 'Grace Hopper'));
  assert.deepEqual((await first.request('/api/orders')).body.orders, [expectedOrder()]);

  const reset = await first.request('/api/reset', 'POST');
  assert.equal(reset.statusCode, 200);
  assert.deepEqual(reset.body, { orders: [], reset: true });
  await assertInitialState(new CookieJar(first.cookie));
  assert.deepEqual((await second.request('/api/orders')).body.orders, [expectedOrder('order-0001', 'Grace Hopper')]);
  const restarted = await first.request('/api/orders', 'POST', checkout);
  assert.deepEqual(restarted.body.order, expectedOrder());
  first.cookie = undefined;
  await assertInitialState(first);
});

test('settings and selected-record updates survive reload while neighboring records stay intact', async () => {
  const jar = new CookieJar();
  await jar.request('/api/orders', 'POST', checkout);
  const profile = await jar.request('/api/profile', 'PATCH', JSON.stringify({ preferredName: '  Ada Verified  ' }));
  assert.equal(profile.statusCode, 200);
  assert.deepEqual(profile.body, { profile: { ...initialProfile, preferredName: 'Ada Verified' }, saved: true });

  for (const status of ['ready', 'archived', 'queued']) {
    const update = await jar.request('/api/records/record-002', 'PATCH', { status });
    assert.equal(update.statusCode, 200);
    const expectedRecords = initialRecords.map((record) => record.id === 'record-002' ? { ...record, status } : record);
    assert.deepEqual(update.body, { record: expectedRecords[1], selectedRecordId: 'record-002' });
    const reloaded = new CookieJar(jar.cookie);
    assert.deepEqual((await reloaded.request('/api/records')).body.records, expectedRecords);
    assert.deepEqual((await reloaded.request('/api/profile')).body.profile, { ...initialProfile, preferredName: 'Ada Verified' });
    assert.deepEqual((await reloaded.request('/api/orders')).body.orders, [expectedOrder()]);
  }
  for (const preferredName of ['Al', '界'.repeat(40)]) {
    assert.equal((await jar.request('/api/profile', 'PATCH', { preferredName })).statusCode, 200);
    assert.deepEqual((await new CookieJar(jar.cookie).request('/api/profile')).body.profile, { ...initialProfile, preferredName });
  }
});

test('search returns the exact matching fixture and admin stays forbidden even with a fabricated role', async () => {
  const jar = new CookieJar(cookieFor({ ...validState(), role: 'admin' }));
  assertError(await jar.request('/api/admin/summary'), 403, 'FORBIDDEN');
  const search = await jar.request('/api/products/search?q=%20VERIFICATION%20PEN%20');
  assert.equal(search.statusCode, 200);
  assert.deepEqual(search.body, {
    query: 'verification pen',
    products: [{ id: 'verification-pen', name: 'Verification Pen', description: 'A second fixture item used to keep the catalog realistic.', unitPriceCents: 499 }],
  });
  assert.deepEqual((await jar.request('/api/products/search?q=missing')).body, { query: 'missing', products: [] });
  const all = await jar.request('/api/products/search');
  assert.ok(Array.isArray(all.body.products));
  assert.equal(all.body.products.length, 2);
});

test('unrelated cookies, array cookie headers, routing defaults, and invalid URLs are handled', async () => {
  const withOtherCookies = await invoke({ url: '/api/orders', headers: { cookie: ['analytics=ignored', cookieFor(validState())] } });
  assert.deepEqual(withOtherCookies.body.orders, [expectedOrder()]);
  await assertInitialState(new CookieJar('analytics=ignored; trenguard_demo_state_other=ignored'));
  assertError(await invoke({ headers: {} }), 404, 'NOT_FOUND');
  assertError(await new CookieJar().request('/missing'), 404, 'NOT_FOUND');
  assertError(await new CookieJar().request('https://['), 400, 'INVALID_URL');
  const mutations = await new CookieJar().request('/api/mutations');
  assert.equal(mutations.statusCode, 200);
  assert.equal(mutations.body.activeMutation, null);
});

const writeRoutes = [
  { route: '/api/orders', method: 'POST', validBody: checkout, error: 'INVALID_ORDER' },
  { route: '/api/profile', method: 'PATCH', validBody: { preferredName: 'Ada Verified' }, error: 'INVALID_PROFILE' },
  { route: '/api/records/record-002', method: 'PATCH', validBody: { status: 'ready' }, error: 'INVALID_RECORD' },
];

for (const { route, method, validBody, error } of writeRoutes) {
  test(`${method} ${route} safely rejects invalid JSON, body shapes, and oversized raw input`, async () => {
    const jar = new CookieJar(cookieFor(validState()));
    const savedCookie = jar.cookie;
    for (const body of [undefined, null, [], true, 4, {}, 'null', '[]', 'false', '42', '"text"', Object.create(validBody) as unknown]) {
      assertError(await jar.request(route, method, body), 400, error);
    }
    for (const body of ['', '{', '{"bad":', Buffer.from('{'), Buffer.from([0xff])]) {
      assertError(await jar.request(route, method, body), 400, 'INVALID_JSON');
    }
    for (const body of [' '.repeat(16_385), Buffer.alloc(16_385)]) {
      assertError(await jar.request(route, method, body), 413, 'BODY_TOO_LARGE');
    }
    assert.equal(jar.cookie, savedCookie);
    assert.deepEqual((await jar.request('/api/orders')).body.orders, [expectedOrder()]);
    assert.deepEqual((await jar.request('/api/profile')).body.profile, initialProfile);
    assert.deepEqual((await jar.request('/api/records')).body.records, initialRecords);
  });
}

test('invalid order fields cannot change the cookie or accept caller-supplied prices', async () => {
  const jar = new CookieJar(cookieFor(validState()));
  const original = jar.cookie;
  for (const customerName of ['', ' \t\n ', 'x'.repeat(81), '界'.repeat(81)]) {
    assertError(await jar.request('/api/orders', 'POST', { ...checkout, customerName }), 400, 'INVALID_CUSTOMER_NAME');
  }
  for (const quantity of [0, -1, 11, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assertError(await jar.request('/api/orders', 'POST', { ...checkout, quantity }), 400, 'INVALID_QUANTITY');
  }
  for (const body of [
    { ...checkout, quantity: '2' }, { ...checkout, customerName: 42 }, { ...checkout, productId: null },
    { ...checkout, totalCents: 1 }, { ...checkout, unitPriceCents: 1 },
  ]) {
    assertError(await jar.request('/api/orders', 'POST', body), 400, 'INVALID_ORDER');
  }
  assertError(await jar.request('/api/orders', 'POST', { ...checkout, productId: 'fabricated-product' }), 400, 'UNKNOWN_PRODUCT');
  assert.equal(jar.cookie, original);
  assert.deepEqual((await jar.request('/api/orders')).body.orders, [expectedOrder()]);
});

test('invalid settings and record inputs preserve fixture identity and all saved state', async () => {
  const jar = new CookieJar(cookieFor(validState()));
  const original = jar.cookie;
  for (const preferredName of ['', 'A', '  ', 'x'.repeat(41)]) {
    assertError(await jar.request('/api/profile', 'PATCH', { preferredName }), 400, 'INVALID_PROFILE_NAME');
  }
  for (const body of [{ preferredName: 12 }, { preferredName: 'Ada', email: 'other@example.test' }, { preferredName: 'Ada', role: 'admin' }]) {
    assertError(await jar.request('/api/profile', 'PATCH', body), 400, 'INVALID_PROFILE');
  }
  for (const body of [{ status: 'deleted' }, { status: null }, { status: 'ready', id: 'record-003' }]) {
    assertError(await jar.request('/api/records/record-002', 'PATCH', body), 400, 'INVALID_RECORD');
  }
  assertError(await jar.request('/api/records/unknown', 'PATCH', { status: 'ready' }), 400, 'UNKNOWN_RECORD');
  assert.equal(jar.cookie, original);
  assert.deepEqual((await jar.request('/api/profile')).body.profile, initialProfile);
  assert.deepEqual((await jar.request('/api/records')).body.records, initialRecords);
});

const malformedCookies: Array<[string, string]> = [
  ['empty value', `${cookieName}=`],
  ['missing equals', cookieName],
  ['bad percent encoding', `${cookieName}=%E0%A4%A`],
  ['bad base64 characters', `${cookieName}=!!!`],
  ['noncanonical base64', `${cookieName}=Zh`],
  ['invalid JSON', `${cookieName}=${Buffer.from('{').toString('base64url')}`],
  ['invalid UTF-8', `${cookieName}=${Buffer.from([0xff]).toString('base64url')}`],
  ['null state', cookieFor(null)],
  ['array state', cookieFor([])],
  ['empty state', cookieFor({})],
  ['oversized value', `${cookieName}=${'A'.repeat(4096)}`],
  ['duplicate name', `${cookieFor(validState())}; ${cookieFor(validState())}`],
];

for (const [name, cookie] of malformedCookies) {
  test(`malformed cookie: ${name} rejects state reads/writes but reset recovers`, async () => {
    const jar = new CookieJar(cookie);
    for (const route of ['/api/orders', '/api/profile', '/api/records']) {
      assertResetError(await jar.request(route));
    }
    for (const { route, method, validBody } of writeRoutes) {
      assertResetError(await jar.request(route, method, validBody));
    }
    assert.equal(jar.cookie, cookie);
    // Reset deliberately needs no body, so even a malformed one cannot trap the demo.
    assert.equal((await jar.request('/api/reset', 'POST', '{')).statusCode, 200);
    await assertInitialState(new CookieJar(jar.cookie));
  });
}

function changedState(path: readonly (string | number)[], replacement: unknown): unknown {
  const state = validState();
  let target: unknown = state;
  for (const key of path.slice(0, -1)) {
    assert.ok(target && typeof target === 'object');
    target = (target as Record<string | number, unknown>)[key];
  }
  const last = path.at(-1);
  assert.notEqual(last, undefined);
  assert.ok(target && typeof target === 'object');
  (target as Record<string | number, unknown>)[last as string | number] = replacement;
  return state;
}

const tamperedFields: Array<[string, Array<string | number>, unknown]> = [
  ['extra root identity', ['role'], 'admin'],
  ['non-array orders', ['orders'], {}],
  ['null order', ['orders', 0], null],
  ['missing order fields', ['orders', 0], { id: 'order-0001' }],
  ['unknown order ID', ['orders', 0, 'id'], 'order-9999'],
  ['duplicate order ID', ['orders'], [expectedOrder(), expectedOrder()]],
  ['extra order field', ['orders', 0, 'paid'], true],
  ['empty customer name', ['orders', 0, 'customerName'], ''],
  ['noncanonical customer name', ['orders', 0, 'customerName'], ' Ada '],
  ['oversized customer name', ['orders', 0, 'customerName'], 'x'.repeat(81)],
  ['non-string customer name', ['orders', 0, 'customerName'], {}],
  ['missing line items', ['orders', 0, 'lineItems'], []],
  ['null line item', ['orders', 0, 'lineItems'], [null]],
  ['multiple line items', ['orders', 0, 'lineItems'], [expectedOrder().lineItems[0], expectedOrder().lineItems[0]]],
  ['unknown product', ['orders', 0, 'lineItems', 0, 'productId'], 'fake-product'],
  ['mismatched product name', ['orders', 0, 'lineItems', 0, 'productName'], 'Free notebook'],
  ['extra line item field', ['orders', 0, 'lineItems', 0, 'discount'], 1299],
  ['zero quantity', ['orders', 0, 'lineItems', 0, 'quantity'], 0],
  ['fractional quantity', ['orders', 0, 'lineItems', 0, 'quantity'], 1.5],
  ['excessive quantity', ['orders', 0, 'lineItems', 0, 'quantity'], 11],
  ['string quantity', ['orders', 0, 'lineItems', 0, 'quantity'], '2'],
  ['fabricated price', ['orders', 0, 'lineItems', 0, 'unitPriceCents'], 1],
  ['string price', ['orders', 0, 'lineItems', 0, 'unitPriceCents'], '1299'],
  ['fabricated line total', ['orders', 0, 'lineItems', 0, 'lineTotalCents'], 1],
  ['fabricated order total', ['orders', 0, 'totalCents'], 1],
  ['fractional order total', ['orders', 0, 'totalCents'], 2598.5],
  ['string order total', ['orders', 0, 'totalCents'], '2598'],
  ['null profile', ['profile'], null],
  ['missing profile fields', ['profile'], { preferredName: 'Ada' }],
  ['fabricated profile identity', ['profile', 'customerName'], 'Admin'],
  ['fabricated profile email', ['profile', 'email'], 'admin@example.test'],
  ['extra profile role', ['profile', 'role'], 'admin'],
  ['short preferred name', ['profile', 'preferredName'], 'A'],
  ['long preferred name', ['profile', 'preferredName'], 'x'.repeat(41)],
  ['untrimmed preferred name', ['profile', 'preferredName'], ' Ada '],
  ['null records', ['records'], null],
  ['empty records', ['records'], []],
  ['missing record', ['records'], initialRecords.slice(0, 2)],
  ['extra record', ['records'], [...initialRecords, initialRecords[0]]],
  ['null record', ['records', 0], null],
  ['duplicate record ID', ['records', 1, 'id'], 'record-001'],
  ['unknown record ID', ['records', 0, 'id'], 'record-999'],
  ['fabricated record label', ['records', 0, 'label'], 'Changed identity'],
  ['invalid record status', ['records', 0, 'status'], 'deleted'],
  ['extra record field', ['records', 0, 'owner'], 'admin'],
  ['reordered records', ['records'], [...initialRecords].reverse()],
  ['too many otherwise valid orders', ['orders'], Array.from({ length: 9 }, (_, index) => expectedOrder(`order-${String(index + 1).padStart(4, '0')}`, 'A'))],
];

for (const [name, path, replacement] of tamperedFields) {
  test(`tampered cookie: ${name} is rejected rather than silently losing orders`, async () => {
    const cookie = cookieFor(changedState(path, replacement));
    const jar = new CookieJar(cookie);
    assertResetError(await jar.request('/api/orders'));
    assertResetError(await jar.request('/api/orders', 'POST', checkout));
    assert.equal(jar.cookie, cookie);
  });
}

test('internally consistent fabricated prices are rejected against the known catalog', async () => {
  const state = validState();
  state.orders = [{
    ...expectedOrder(),
    lineItems: [{ productId: 'proofforge-notebook', productName: 'TrenGuard Notebook', quantity: 2, unitPriceCents: 1, lineTotalCents: 2 }],
    totalCents: 2,
  }];
  assertResetError(await new CookieJar(cookieFor(state)).request('/api/orders'));
});

test('unsigned state cannot authenticate an otherwise valid fabricated history', async () => {
  // Document the demo boundary: schema validation is not a signature or a database.
  const state = validState();
  state.profile.preferredName = 'Fabricated but valid';
  const jar = new CookieJar(cookieFor(state));
  assert.deepEqual((await jar.request('/api/orders')).body.orders, state.orders);
  assert.deepEqual((await jar.request('/api/profile')).body.profile, state.profile);
  assertError(await jar.request('/api/admin/summary'), 403, 'FORBIDDEN');
});

test('the ninth small order fails before success and preserves all eight prior orders', async () => {
  const jar = new CookieJar();
  const expected = [];
  for (let index = 1; index <= 8; index += 1) {
    const result = await jar.request('/api/orders', 'POST', { ...checkout, customerName: 'A' });
    assert.equal(result.statusCode, 201);
    expected.push(expectedOrder(`order-${String(index).padStart(4, '0')}`, 'A'));
    assert.deepEqual(result.body.order, expected.at(-1));
  }
  const previousCookie = jar.cookie;
  assertResetError(await jar.request('/api/orders', 'POST', checkout), 'DEMO_STATE_FULL');
  assert.equal(jar.cookie, previousCookie);
  assert.deepEqual((await new CookieJar(jar.cookie).request('/api/orders')).body.orders, expected);
  assert.equal((await jar.request('/api/reset', 'POST')).statusCode, 200);
  assert.equal((await jar.request('/api/orders', 'POST', checkout)).statusCode, 201);
  assert.deepEqual((await jar.request('/api/orders')).body.orders, [expectedOrder()]);
});

for (const [label, customerName] of [['multibyte UTF-8', '界'.repeat(80)], ['JSON escaping', '\u0000'.repeat(80)]]) {
  test(`cookie byte limit handles ${label} before the order-count limit without dropping history`, async () => {
    const jar = new CookieJar();
    const saved: unknown[] = [];
    let reachedLimit = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const previousCookie = jar.cookie;
      const result = await jar.request('/api/orders', 'POST', { ...checkout, customerName });
      if (result.statusCode === 409) {
        assertResetError(result, 'DEMO_STATE_FULL');
        assert.equal(jar.cookie, previousCookie);
        reachedLimit = true;
        break;
      }
      assert.equal(result.statusCode, 201);
      saved.push(result.body.order);
      assert.deepEqual((await new CookieJar(jar.cookie).request('/api/orders')).body.orders, saved);
    }
    assert.ok(reachedLimit, 'byte budget must reject the write before eight orders');
    assert.ok(saved.length > 0);
    assert.deepEqual((await new CookieJar(jar.cookie).request('/api/orders')).body.orders, saved);
    assert.equal((await jar.request('/api/reset', 'POST')).statusCode, 200);
    await assertInitialState(jar);
  });
}

function nearlyFullState() {
  const state = validState();
  state.orders = Array.from({ length: 8 }, (_, index) => expectedOrder(`order-${String(index + 1).padStart(4, '0')}`, 'A'));
  state.records.forEach((record) => { record.status = 'ready'; });
  // Construct a valid inbound cookie right at the byte boundary to exercise
  // profile and record growth independently of checkout's count limit.
  for (const order of state.orders) {
    while (order.customerName.length < 80) {
      order.customerName += 'é';
      if (Buffer.byteLength(cookieFor(state) + cookieAttributes) > 3800) {
        order.customerName = order.customerName.slice(0, -1);
        return state;
      }
    }
  }
  assert.fail('fixture should reach the byte boundary');
}

for (const [route, body] of [
  ['/api/profile', { preferredName: '界'.repeat(40) }],
  ['/api/records/record-001', { status: 'archived' }],
] as const) {
  test(`${route} also rejects cookie growth atomically at the byte boundary`, async () => {
    const state = nearlyFullState();
    const cookie = cookieFor(state);
    const size = Buffer.byteLength(cookie + cookieAttributes);
    assert.ok(size >= 3797 && size <= 3800);
    const jar = new CookieJar(cookie);
    assert.deepEqual((await jar.request('/api/orders')).body.orders, state.orders);
    assertResetError(await jar.request(route, 'PATCH', body), 'DEMO_STATE_FULL');
    assert.equal(jar.cookie, cookie);
    assert.deepEqual((await jar.request('/api/orders')).body.orders, state.orders);
    assert.deepEqual((await jar.request('/api/profile')).body.profile, state.profile);
    assert.deepEqual((await jar.request('/api/records')).body.records, state.records);
    assert.equal((await jar.request('/api/reset', 'POST')).statusCode, 200);
    await assertInitialState(jar);
  });
}

test('oversized but structurally valid cookie state is rejected and resettable', async () => {
  const state = nearlyFullState();
  state.profile.preferredName = '界'.repeat(40);
  const cookie = cookieFor(state);
  assert.ok(Buffer.byteLength(cookie + cookieAttributes) > 3800);
  const jar = new CookieJar(cookie);
  assertResetError(await jar.request('/api/orders'));
  assert.equal(jar.cookie, cookie);
  assert.equal((await jar.request('/api/reset', 'POST')).statusCode, 200);
  await assertInitialState(jar);
});
