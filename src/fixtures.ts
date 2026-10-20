export interface ProductFixture {
  id: string;
  name: string;
  description: string;
  unitPriceCents: number;
}

export interface CheckoutFixture {
  productId: string;
  quantity: number;
  customerName: string;
}

export interface OrderLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface OrderRecord {
  id: string;
  customerName: string;
  lineItems: OrderLineItem[];
  totalCents: number;
}

export interface ProfileRecord {
  customerName: string;
  email: string;
  preferredName: string;
}

export interface ManagedRecord {
  id: string;
  label: string;
  status: 'ready' | 'queued' | 'archived';
}

export const PROFILE_FIXTURE: ProfileRecord = {
  customerName: 'Ada Lovelace',
  email: 'ada@example.test',
  preferredName: 'Ada',
};

export const RECORD_FIXTURES: readonly ManagedRecord[] = [
  { id: 'record-001', label: 'Verification corpus', status: 'ready' },
  { id: 'record-002', label: 'Checkout journey', status: 'queued' },
  { id: 'record-003', label: 'Replay safety notes', status: 'archived' },
];

export const PRODUCT_FIXTURES: readonly ProductFixture[] = [
  {
    id: 'proofforge-notebook',
    name: 'TrenGuard Notebook',
    description: 'A fixed fixture item for repeatable checkout tests.',
    unitPriceCents: 1299,
  },
  {
    id: 'verification-pen',
    name: 'Verification Pen',
    description: 'A second fixture item used to keep the catalog realistic.',
    unitPriceCents: 499,
  },
];

export const CHECKOUT_FIXTURE: CheckoutFixture = {
  productId: 'proofforge-notebook',
  quantity: 2,
  customerName: 'Ada Lovelace',
};

export const FIXTURE_DATA_VERSION = 'phase-1-v1';

export function findProduct(productId: string): ProductFixture | undefined {
  return PRODUCT_FIXTURES.find((product) => product.id === productId);
}

export function calculateLineTotalCents(product: ProductFixture, quantity: number): number {
  return product.unitPriceCents * quantity;
}
