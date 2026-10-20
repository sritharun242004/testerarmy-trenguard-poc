import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  calculateLineTotalCents,
  findProduct,
  PROFILE_FIXTURE,
  RECORD_FIXTURES,
  type ManagedRecord,
  type OrderRecord,
  type ProfileRecord,
} from './fixtures.js';

interface StoredState {
  dataVersion: string;
  orders: OrderRecord[];
  profile: ProfileRecord;
  records: ManagedRecord[];
}

const DATA_VERSION = 'phase-1-v1';

export class OrderStore {
  private state: StoredState = createInitialState();

  public constructor(private readonly filePath: string) {}

  public async initialize(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const contents = await readFile(this.filePath, 'utf8');
      this.state = this.parseState(contents);
    } catch (error: unknown) {
      if (!isFileNotFound(error)) {
        throw error;
      }
      await this.persist();
    }
  }

  public listOrders(): OrderRecord[] {
    return structuredClone(this.state.orders);
  }

  public getProfile(): ProfileRecord {
    return structuredClone(this.state.profile);
  }

  public listRecords(): ManagedRecord[] {
    return structuredClone(this.state.records);
  }

  public async reset(): Promise<void> {
    this.state = createInitialState();
    await this.persist();
  }

  public async createOrder(input: {
    customerName: string;
    productId: string;
    quantity: number;
  }, options: { persist?: boolean; incorrectTotal?: boolean } = {}): Promise<OrderRecord> {
    const product = findProduct(input.productId);
    if (!product) {
      throw new StoreInputError('UNKNOWN_PRODUCT', 'The requested fixture product does not exist.');
    }

    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) {
      throw new StoreInputError('INVALID_QUANTITY', 'Quantity must be a whole number from 1 to 10.');
    }

    const lineTotalCents = calculateLineTotalCents(product, input.quantity);
    const totalCents = options.incorrectTotal === true
      ? calculateLineTotalCents(product, 1)
      : lineTotalCents;
    const order: OrderRecord = {
      id: `order-${String(this.state.orders.length + 1).padStart(4, '0')}`,
      customerName: input.customerName,
      lineItems: [
        {
          productId: product.id,
          productName: product.name,
          quantity: input.quantity,
          unitPriceCents: product.unitPriceCents,
          lineTotalCents,
        },
      ],
      totalCents,
    };

    if (options.persist !== false) {
      this.state.orders.push(order);
      await this.persist();
    }
    return structuredClone(order);
  }

  public async updateProfile(input: { preferredName: string }, options: { persist?: boolean } = {}): Promise<ProfileRecord> {
    const preferredName = input.preferredName.trim();
    if (preferredName.length < 2 || preferredName.length > 40) {
      throw new StoreInputError('INVALID_PROFILE_NAME', 'Preferred name must be between 2 and 40 characters.');
    }

    const updated = { ...this.state.profile, preferredName };
    if (options.persist !== false) {
      this.state.profile = updated;
      await this.persist();
    }
    return structuredClone(updated);
  }

  public async updateRecord(recordId: string, status: ManagedRecord['status'], options: { wrongRecordAction?: boolean } = {}): Promise<ManagedRecord> {
    const targetId = options.wrongRecordAction === true
      ? this.neighboringRecordId(recordId)
      : recordId;
    const index = this.state.records.findIndex((record) => record.id === targetId);
    if (index < 0) {
      throw new StoreInputError('UNKNOWN_RECORD', 'The selected fixture record does not exist.');
    }

    const current = this.state.records[index];
    if (!current) {
      throw new StoreInputError('UNKNOWN_RECORD', 'The selected fixture record does not exist.');
    }
    const updated = { ...current, status };
    this.state.records[index] = updated;
    await this.persist();
    return structuredClone(updated);
  }

  private parseState(contents: string): StoredState {
    const parsed: unknown = JSON.parse(contents);
    if (!isStoredState(parsed)) {
      throw new Error(`Invalid TrenGuard data file: ${this.filePath}`);
    }
    return {
      dataVersion: DATA_VERSION,
      orders: parsed.orders,
      profile: parsed.profile ?? structuredClone(PROFILE_FIXTURE),
      records: parsed.records ?? structuredClone([...RECORD_FIXTURES]),
    };
  }

  private neighboringRecordId(recordId: string): string {
    const index = this.state.records.findIndex((record) => record.id === recordId);
    return this.state.records[(index + 1) % this.state.records.length]?.id ?? recordId;
  }

  private async persist(): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, this.filePath);
  }
}

export class StoreInputError extends Error {
  public constructor(
    public readonly code: 'UNKNOWN_PRODUCT' | 'INVALID_QUANTITY' | 'INVALID_PROFILE_NAME' | 'UNKNOWN_RECORD',
    message: string,
  ) {
    super(message);
    this.name = 'StoreInputError';
  }
}

function createInitialState(): StoredState {
  return {
    dataVersion: DATA_VERSION,
    orders: [],
    profile: structuredClone(PROFILE_FIXTURE),
    records: structuredClone([...RECORD_FIXTURES]),
  };
}

function isFileNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

type ParsedState = {
  dataVersion: string;
  orders: OrderRecord[];
  profile?: ProfileRecord;
  records?: ManagedRecord[];
};

function isStoredState(value: unknown): value is ParsedState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    dataVersion?: unknown;
    orders?: unknown;
    profile?: unknown;
    records?: unknown;
  };
  return candidate.dataVersion === DATA_VERSION
    && Array.isArray(candidate.orders)
    && (candidate.profile === undefined || isProfile(candidate.profile))
    && (candidate.records === undefined || isRecords(candidate.records));
}

function isProfile(value: unknown): value is ProfileRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.customerName === 'string'
    && typeof candidate.email === 'string'
    && typeof candidate.preferredName === 'string';
}

function isRecords(value: unknown): value is ManagedRecord[] {
  return Array.isArray(value) && value.every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as Record<string, unknown>;
    return typeof candidate.id === 'string'
      && typeof candidate.label === 'string'
      && (candidate.status === 'ready' || candidate.status === 'queued' || candidate.status === 'archived');
  });
}
