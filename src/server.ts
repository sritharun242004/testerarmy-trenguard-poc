import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CHECKOUT_FIXTURE,
  FIXTURE_DATA_VERSION,
  PRODUCT_FIXTURES,
} from './fixtures.js';
import { MUTATION_REGISTRY, resolveMutation } from './mutations.js';
import { OrderStore, StoreInputError } from './store.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(projectRoot, 'public');
const dataFile = process.env.PROOFORGE_DATA_FILE ?? path.join(projectRoot, 'data', 'orders.json');
const host = process.env.HOST ?? '127.0.0.1';
const portArgumentIndex = process.argv.indexOf('--port');
const requestedPort = portArgumentIndex >= 0 ? process.argv[portArgumentIndex + 1] : undefined;
const port = parsePort(process.env.PORT ?? requestedPort ?? '4173');
const mutation = resolveMutation(process.env.PROOFFORGE_MUTATION);
const store = new OrderStore(dataFile);

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error: unknown) => {
    console.error(error);
    sendJson(response, 500, { error: 'INTERNAL_SERVER_ERROR' });
  });
});

await store.initialize();
server.listen(port, host, () => {
  console.log(`TrenGuard demo listening at http://${host}:${port}`);
});

process.once('SIGINT', () => shutdown());
process.once('SIGTERM', () => shutdown());

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`);
  const pathname = requestUrl.pathname;

  if (request.method === 'GET' && pathname === '/health') {
    sendJson(response, 200, {
      status: 'ok',
      dataVersion: FIXTURE_DATA_VERSION,
      mutationId: mutation.id,
      mutationMarker: mutation.marker,
    });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/fixtures') {
    sendJson(response, 200, {
      dataVersion: FIXTURE_DATA_VERSION,
      products: PRODUCT_FIXTURES,
      checkout: CHECKOUT_FIXTURE,
      mutation: { id: mutation.id, marker: mutation.marker },
    });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/mutations') {
    sendJson(response, 200, {
      activeMutation: mutation.id,
      mutations: MUTATION_REGISTRY.map(({ apply: _apply, ...definition }) => definition),
    });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/orders') {
    sendJson(response, 200, { orders: store.listOrders() });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/reset') {
    await store.reset();
    sendJson(response, 200, { orders: store.listOrders(), reset: true });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/orders') {
    await createOrder(request, response);
    return;
  }

  if (request.method === 'GET' && pathname === '/api/profile') {
    sendJson(response, 200, { profile: store.getProfile() });
    return;
  }

  if (request.method === 'PATCH' && pathname === '/api/profile') {
    await updateProfile(request, response);
    return;
  }

  if (request.method === 'GET' && pathname === '/api/admin/summary') {
    if (!mutation.allowUnauthorized) {
      sendJson(response, 403, { error: 'FORBIDDEN', message: 'Admin access is required.' });
      return;
    }
    sendJson(response, 200, { user: 'Ada Lovelace', summary: 'Fixture admin summary' });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/products/search') {
    const query = requestUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';
    const products = PRODUCT_FIXTURES.filter((product) => {
      const matches = `${product.name} ${product.description}`.toLowerCase().includes(query);
      return matches && product.id !== mutation.omittedProductId;
    });
    sendJson(response, 200, { query, products });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/records') {
    sendJson(response, 200, { records: store.listRecords() });
    return;
  }

  if (request.method === 'PATCH' && pathname.startsWith('/api/records/')) {
    await updateRecord(pathname.slice('/api/records/'.length), request, response);
    return;
  }

  if (request.method === 'GET') {
    await serveStaticPage(pathname, response);
    return;
  }

  sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
}

async function createOrder(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const body = await readJson(request);
    if (!isOrderRequest(body)) {
      sendJson(response, 400, { error: 'INVALID_ORDER', message: 'The order payload is invalid.' });
      return;
    }

    const order = await store.createOrder(body, {
      persist: mutation.persistOrder,
      incorrectTotal: mutation.incorrectTotal,
    });
    sendJson(response, 201, { order });
  } catch (error: unknown) {
    if (error instanceof StoreInputError) {
      sendJson(response, 400, { error: error.code, message: error.message });
      return;
    }

    if (error instanceof RequestBodyError) {
      sendJson(response, 400, { error: 'INVALID_JSON', message: error.message });
      return;
    }

    throw error;
  }
}

async function updateProfile(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const body = await readJson(request);
    if (!isProfileRequest(body)) {
      sendJson(response, 400, { error: 'INVALID_PROFILE', message: 'The profile payload is invalid.' });
      return;
    }

    const profile = await store.updateProfile(body, { persist: mutation.persistProfile });
    sendJson(response, 200, { profile, saved: true });
  } catch (error: unknown) {
    if (error instanceof StoreInputError) {
      sendJson(response, 400, { error: error.code, message: error.message });
      return;
    }
    if (error instanceof RequestBodyError) {
      sendJson(response, 400, { error: 'INVALID_JSON', message: error.message });
      return;
    }
    throw error;
  }
}

async function updateRecord(recordId: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const body = await readJson(request);
    if (!isRecordRequest(body)) {
      sendJson(response, 400, { error: 'INVALID_RECORD', message: 'The record payload is invalid.' });
      return;
    }

    const record = await store.updateRecord(recordId, body.status, { wrongRecordAction: mutation.wrongRecordAction });
    sendJson(response, 200, { record, selectedRecordId: recordId });
  } catch (error: unknown) {
    if (error instanceof StoreInputError) {
      sendJson(response, 400, { error: error.code, message: error.message });
      return;
    }
    if (error instanceof RequestBodyError) {
      sendJson(response, 400, { error: 'INVALID_JSON', message: error.message });
      return;
    }
    throw error;
  }
}

async function serveStaticPage(pathname: string, response: ServerResponse): Promise<void> {
  const asset = pathname === '/app.js'
    ? { file: 'app.js', contentType: 'text/javascript; charset=utf-8' }
    : pathname === '/styles.css'
      ? { file: 'styles.css', contentType: 'text/css; charset=utf-8' }
      : pathname === '/' || pathname === '/checkout' || pathname === '/orders'
        || pathname === '/settings' || pathname === '/admin' || pathname === '/search' || pathname === '/records'
        ? { file: 'index.html', contentType: 'text/html; charset=utf-8' }
        : undefined;

  if (!asset) {
    sendJson(response, 404, { error: 'NOT_FOUND' });
    return;
  }

  const contents = await readFile(path.join(publicRoot, asset.file));
  response.writeHead(200, { 'content-type': asset.contentType, 'cache-control': 'no-store' });
  response.end(contents);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > 16_384) {
      throw new RequestBodyError('Request body is too large.');
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new RequestBodyError('Request body must be valid JSON.');
  }
}

function isOrderRequest(value: unknown): value is {
  customerName: string;
  productId: string;
  quantity: number;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.customerName === 'string'
    && candidate.customerName.length > 0
    && typeof candidate.productId === 'string'
    && typeof candidate.quantity === 'number';
}

function isProfileRequest(value: unknown): value is { preferredName: string } {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as Record<string, unknown>).preferredName === 'string';
}

function isRecordRequest(value: unknown): value is { status: 'ready' | 'queued' | 'archived' } {
  if (!value || typeof value !== 'object') return false;
  const status = (value as Record<string, unknown>).status;
  return status === 'ready' || status === 'queued' || status === 'archived';
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function parsePort(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535; received ${value}`);
  }
  return parsed;
}

function shutdown(): void {
  server.close((error?: Error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

class RequestBodyError extends Error {}
