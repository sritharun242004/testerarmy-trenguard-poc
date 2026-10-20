import {
  calculateLineTotalCents,
  CHECKOUT_FIXTURE,
  findProduct,
  FIXTURE_DATA_VERSION,
  PRODUCT_FIXTURES,
  PROFILE_FIXTURE,
  RECORD_FIXTURES,
  type ManagedRecord,
  type OrderRecord,
  type ProfileRecord,
} from '../src/fixtures.js';
import { MUTATION_REGISTRY, resolveMutation } from '../src/mutations.js';

interface HostedRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface HostedResponse {
  status(code: number): HostedResponse;
  setHeader(name: string, value: string | string[]): HostedResponse;
  json(payload: unknown): void;
}

interface HostedState {
  orders: OrderRecord[];
  profile: ProfileRecord;
  records: ManagedRecord[];
}

const STATE_COOKIE = 'trenguard_demo_state';
const COOKIE_MAX_AGE_SECONDS = 60 * 60;
// Include the name and attributes in the budget, leaving room below 4096 bytes.
const MAX_COOKIE_BYTES = 3_800;
const MAX_ORDERS = 8;
const MAX_CUSTOMER_NAME_LENGTH = 80;
const MAX_BODY_BYTES = 16_384;
const mutation = resolveMutation(process.env.PROOFFORGE_MUTATION);

export default async function handler(request: HostedRequest, response: HostedResponse): Promise<void> {
  try {
    await handleRequest(request, response);
  } catch (error: unknown) {
    if (!(error instanceof RequestBodyError)) throw error;
    sendJson(response, error.statusCode, { error: error.code, message: error.message });
  }
}

async function handleRequest(request: HostedRequest, response: HostedResponse): Promise<void> {
  let url: URL;
  try {
    url = new URL(request.url ?? '/', 'https://trenguard.vercel.app');
  } catch {
    sendJson(response, 400, { error: 'INVALID_URL', message: 'The request URL is invalid.' });
    return;
  }
  const pathname = url.pathname;
  const method = request.method ?? 'GET';

  if (method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
    sendJson(response, 200, {
      status: 'ok',
      dataVersion: FIXTURE_DATA_VERSION,
      mutationId: mutation.id,
      mutationMarker: mutation.marker,
      hosted: true,
      persistence: 'browser-cookie-demo-state',
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/fixtures') {
    sendJson(response, 200, {
      dataVersion: FIXTURE_DATA_VERSION,
      products: PRODUCT_FIXTURES,
      checkout: CHECKOUT_FIXTURE,
      mutation: { id: mutation.id, marker: mutation.marker },
      hosted: true,
      persistence: 'browser-cookie-demo-state',
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/mutations') {
    sendJson(response, 200, {
      activeMutation: mutation.id,
      mutations: MUTATION_REGISTRY.map(({ apply: _apply, ...definition }) => definition),
    });
    return;
  }

  if (method === 'POST' && pathname === '/api/reset') {
    const resetState = createInitialState();
    sendState(response, 200, { orders: resetState.orders, reset: true }, resetState);
    return;
  }

  if (method === 'GET' && pathname === '/api/admin/summary') {
    if (!mutation.allowUnauthorized) {
      sendJson(response, 403, { error: 'FORBIDDEN', message: 'Admin access is required.' });
      return;
    }
    sendJson(response, 200, { user: 'Ada Lovelace', summary: 'Fixture admin summary' });
    return;
  }

  if (method === 'GET' && pathname === '/api/products/search') {
    const query = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
    const products = PRODUCT_FIXTURES.filter((product) => {
      const matches = `${product.name} ${product.description}`.toLowerCase().includes(query);
      return matches && product.id !== mutation.omittedProductId;
    });
    sendJson(response, 200, { query, products });
    return;
  }

  const state = readState(request);
  if (!state) {
    sendJson(response, 409, {
      error: 'INVALID_DEMO_STATE',
      message: 'The demo cookie is invalid or too large. Reset the demo using POST /api/reset and try again.',
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/orders') {
    sendJson(response, 200, { orders: state.orders });
    return;
  }

  if (method === 'POST' && pathname === '/api/orders') {
    await createOrder(request, response, state);
    return;
  }

  if (method === 'GET' && pathname === '/api/profile') {
    sendJson(response, 200, { profile: state.profile });
    return;
  }

  if (method === 'PATCH' && pathname === '/api/profile') {
    await updateProfile(request, response, state);
    return;
  }

  if (method === 'GET' && pathname === '/api/records') {
    sendJson(response, 200, { records: state.records });
    return;
  }

  if (method === 'PATCH' && pathname.startsWith('/api/records/')) {
    await updateRecord(pathname.slice('/api/records/'.length), request, response, state);
    return;
  }

  sendJson(response, 404, { error: 'NOT_FOUND' });
}

async function createOrder(request: HostedRequest, response: HostedResponse, state: HostedState): Promise<void> {
  const body = readBody(request);
  if (!isOrderRequest(body)) {
    sendJson(response, 400, { error: 'INVALID_ORDER', message: 'The order payload is invalid.' });
    return;
  }

  const customerName = body.customerName.trim();
  if (body.customerName.length > MAX_CUSTOMER_NAME_LENGTH || !isName(customerName, 1, MAX_CUSTOMER_NAME_LENGTH)) {
    sendJson(response, 400, { error: 'INVALID_CUSTOMER_NAME', message: 'Customer name must be between 1 and 80 characters.' });
    return;
  }

  const product = findProduct(body.productId);
  if (!product) {
    sendJson(response, 400, { error: 'UNKNOWN_PRODUCT', message: 'The requested fixture product does not exist.' });
    return;
  }

  if (!Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 10) {
    sendJson(response, 400, { error: 'INVALID_QUANTITY', message: 'Quantity must be a whole number from 1 to 10.' });
    return;
  }

  const lineTotalCents = calculateLineTotalCents(product, body.quantity);
  const totalCents = mutation.incorrectTotal ? calculateLineTotalCents(product, 1) : lineTotalCents;
  const order: OrderRecord = {
    id: `order-${String(state.orders.length + 1).padStart(4, '0')}`,
    customerName,
    lineItems: [{
      productId: product.id,
      productName: product.name,
      quantity: body.quantity,
      unitPriceCents: product.unitPriceCents,
      lineTotalCents,
    }],
    totalCents,
  };

  const nextState = mutation.persistOrder ? { ...state, orders: [...state.orders, order] } : state;
  sendState(response, 201, { order }, nextState);
}

async function updateProfile(request: HostedRequest, response: HostedResponse, state: HostedState): Promise<void> {
  const body = readBody(request);
  if (!isProfileRequest(body)) {
    sendJson(response, 400, { error: 'INVALID_PROFILE', message: 'The profile payload is invalid.' });
    return;
  }

  const preferredName = body.preferredName.trim();
  if (body.preferredName.length > 40 || !isName(preferredName, 2, 40)) {
    sendJson(response, 400, { error: 'INVALID_PROFILE_NAME', message: 'Preferred name must be between 2 and 40 characters.' });
    return;
  }

  const profile = { ...state.profile, preferredName };
  const nextState = mutation.persistProfile ? { ...state, profile } : state;
  sendState(response, 200, { profile, saved: true }, nextState);
}

async function updateRecord(recordId: string, request: HostedRequest, response: HostedResponse, state: HostedState): Promise<void> {
  const body = readBody(request);
  if (!isRecordRequest(body)) {
    sendJson(response, 400, { error: 'INVALID_RECORD', message: 'The record payload is invalid.' });
    return;
  }

  const selectedIndex = state.records.findIndex((record) => record.id === recordId);
  if (selectedIndex < 0) {
    sendJson(response, 400, { error: 'UNKNOWN_RECORD', message: 'The selected fixture record does not exist.' });
    return;
  }

  const targetIndex = mutation.wrongRecordAction
    ? (selectedIndex + 1) % state.records.length
    : selectedIndex;
  const current = state.records[targetIndex];
  if (!current) {
    sendJson(response, 400, { error: 'UNKNOWN_RECORD', message: 'The selected fixture record does not exist.' });
    return;
  }

  const record = { ...current, status: body.status };
  const records = state.records.map((entry, index) => index === targetIndex ? record : entry);
  sendState(response, 200, { record, selectedRecordId: recordId }, { ...state, records });
}

function createInitialState(): HostedState {
  return {
    orders: [],
    profile: structuredClone(PROFILE_FIXTURE),
    records: structuredClone([...RECORD_FIXTURES]),
  };
}

function readState(request: HostedRequest): HostedState | undefined {
  const cookies = request.headers.cookie;
  const cookieHeader = Array.isArray(cookies) ? cookies.join(';') : cookies ?? '';
  const matches = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie === STATE_COOKIE || cookie.startsWith(`${STATE_COOKIE}=`));

  if (matches.length === 0) return createInitialState();
  // Duplicate names are ambiguous; never pick a potentially different state.
  if (matches.length !== 1) return undefined;
  const encoded = matches[0]?.slice(STATE_COOKIE.length + 1) ?? '';
  if (Buffer.byteLength(formatCookie(encoded), 'utf8') > MAX_COOKIE_BYTES || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    return undefined;
  }

  try {
    const bytes = Buffer.from(encoded, 'base64url');
    if (bytes.toString('base64url') !== encoded) return undefined;
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return isHostedState(parsed) && Buffer.byteLength(stateCookie(parsed), 'utf8') <= MAX_COOKIE_BYTES
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

function stateCookie(state: HostedState): string {
  return formatCookie(Buffer.from(JSON.stringify(state), 'utf8').toString('base64url'));
}

function formatCookie(value: string): string {
  return `${STATE_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}`;
}

function sendState(response: HostedResponse, statusCode: number, payload: unknown, state: HostedState): void {
  const cookie = stateCookie(state);
  if (state.orders.length > MAX_ORDERS || Buffer.byteLength(cookie, 'utf8') > MAX_COOKIE_BYTES) {
    sendJson(response, 409, {
      error: 'DEMO_STATE_FULL',
      message: 'The demo cookie is full. Reset the demo using POST /api/reset before saving more changes.',
    });
    return;
  }
  sendJson(response, statusCode, payload, cookie);
}

function sendJson(response: HostedResponse, statusCode: number, payload: unknown, cookie?: string): void {
  response.status(statusCode).setHeader('Cache-Control', 'no-store');
  if (cookie !== undefined) response.setHeader('Set-Cookie', cookie);
  response.json(payload);
}

function readBody(request: HostedRequest): unknown {
  const body = request.body;
  if (typeof body !== 'string' && !Buffer.isBuffer(body)) return body;
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
    throw new RequestBodyError(413, 'BODY_TOO_LARGE', 'Request body must not exceed 16384 bytes.');
  }
  try {
    return JSON.parse(typeof body === 'string' ? body : new TextDecoder('utf-8', { fatal: true }).decode(body)) as unknown;
  } catch {
    throw new RequestBodyError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

function isOrderRequest(value: unknown): value is { customerName: string; productId: string; quantity: number } {
  return hasExactKeys(value, ['customerName', 'productId', 'quantity'])
    && typeof value.customerName === 'string'
    && typeof value.productId === 'string'
    && typeof value.quantity === 'number';
}

function isProfileRequest(value: unknown): value is { preferredName: string } {
  return hasExactKeys(value, ['preferredName']) && typeof value.preferredName === 'string';
}

function isRecordRequest(value: unknown): value is { status: ManagedRecord['status'] } {
  return hasExactKeys(value, ['status']) && isRecordStatus(value.status);
}

// This validates structure and fixture consistency, not authenticity: an unsigned
// cookie can still be fabricated with otherwise valid demo values.
function isHostedState(value: unknown): value is HostedState {
  return hasExactKeys(value, ['orders', 'profile', 'records'])
    && Array.isArray(value.orders)
    && value.orders.length <= MAX_ORDERS
    && value.orders.every(isOrder)
    && isProfile(value.profile)
    && isRecords(value.records);
}

function isOrder(value: unknown, index: number): value is OrderRecord {
  if (!hasExactKeys(value, ['id', 'customerName', 'lineItems', 'totalCents'])
    || value.id !== `order-${String(index + 1).padStart(4, '0')}`
    || !isName(value.customerName, 1, MAX_CUSTOMER_NAME_LENGTH)
    || !Array.isArray(value.lineItems)
    || value.lineItems.length !== 1) return false;

  const line: unknown = value.lineItems[0];
  if (!hasExactKeys(line, ['productId', 'productName', 'quantity', 'unitPriceCents', 'lineTotalCents'])
    || typeof line.productId !== 'string'
    || typeof line.quantity !== 'number'
    || !Number.isInteger(line.quantity)
    || line.quantity < 1 || line.quantity > 10) return false;

  const product = findProduct(line.productId);
  if (!product) return false;
  const lineTotal = calculateLineTotalCents(product, line.quantity);
  // Keep the existing explicit M2 demo behavior consistent across reloads.
  const total = mutation.incorrectTotal ? product.unitPriceCents : lineTotal;
  return line.productName === product.name
    && line.unitPriceCents === product.unitPriceCents
    && line.lineTotalCents === lineTotal
    && value.totalCents === total;
}

function isProfile(value: unknown): value is ProfileRecord {
  return hasExactKeys(value, ['customerName', 'email', 'preferredName'])
    && value.customerName === PROFILE_FIXTURE.customerName
    && value.email === PROFILE_FIXTURE.email
    && isName(value.preferredName, 2, 40);
}

function isRecords(value: unknown): value is ManagedRecord[] {
  return Array.isArray(value)
    && value.length === RECORD_FIXTURES.length
    && value.every((entry: unknown, index) => {
      const fixture = RECORD_FIXTURES[index];
      return hasExactKeys(entry, ['id', 'label', 'status'])
        && entry.id === fixture?.id
        && entry.label === fixture?.label
        && isRecordStatus(entry.status);
    });
}

function isRecordStatus(value: unknown): value is ManagedRecord['status'] {
  return value === 'ready' || value === 'queued' || value === 'archived';
}

function isName(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string'
    && value.length >= minimum && value.length <= maximum
    && value === value.trim();
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

class RequestBodyError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
