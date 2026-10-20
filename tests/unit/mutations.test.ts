import assert from 'node:assert/strict';
import test from 'node:test';

import { findMutation, M1_ID, resolveMutation } from '../../src/mutations.js';

test('healthy activation is explicit and persists orders', () => {
  assert.deepEqual(resolveMutation(undefined), {
    id: null,
    marker: 'HEALTHY_BASELINE',
    persistOrder: true,
    incorrectTotal: false,
    allowUnauthorized: false,
    omittedProductId: null,
    persistProfile: true,
    wrongRecordAction: false,
  });
});

test('M1 has stable metadata and disables persistence only', () => {
  const definition = findMutation(M1_ID);

  assert.ok(definition);
  assert.equal(definition.id, 'M1');
  assert.equal(definition.expectedFailureSignal, 'ORDER_MISSING_AFTER_RELOAD');
  assert.deepEqual(definition.apply(), {
    id: 'M1',
    marker: 'M1_ACTIVE',
    persistOrder: false,
    incorrectTotal: false,
    allowUnauthorized: false,
    omittedProductId: null,
    persistProfile: true,
    wrongRecordAction: false,
  });
});

test('unknown mutation IDs fail closed', () => {
  assert.throws(
    () => resolveMutation('M99'),
    /Unknown or non-deterministic mutation "M99"\. Known mutations: M1/,
  );
});
