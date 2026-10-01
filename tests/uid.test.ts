import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePublicList, applicationPayload, validateApplication, submissionResult } from '../src/uid/core';

test('public blacklist preserves string UIDs and deduplicates aliases without inventing reasons', () => {
  const list = parsePublicList({ Players: [
    { Uid: '12345678901234567890', Aliases: ['Alpha'], Note: '', UpdatedAt: '2026-09-01' },
    { Uid: '12345678901234567890', Aliases: ['Alpha', 'Beta'], Note: '', UpdatedAt: '2026-09-02' },
  ] });
  assert.equal(list.length, 1);
  assert.equal(list[0].uid, '12345678901234567890');
  assert.deepEqual(list[0].aliases, ['Alpha', 'Beta']);
  assert.equal(list[0].reason, '');
  assert.throws(() => parsePublicList({ Players: [{ Uid: 123, Aliases: ['A'] }] }));
  assert.throws(() => parsePublicList({ Players: [{ Uid: '123', Aliases: '<script>' }] }));
});

test('application rejects invalid UIDs, empty reasons and executable evidence links', () => {
  const valid = { uid: '123456', nickname: 'Alpha', reason: '详细申请原因以及经过', evidence: 'https://example.com/replay' };
  assert.equal(validateApplication(valid), null);
  assert.ok(validateApplication({ ...valid, uid: 'abc' }));
  assert.ok(validateApplication({ ...valid, reason: ' ' }));
  assert.ok(validateApplication({ ...valid, evidence: 'javascript:alert(1)' }));
  assert.ok(validateApplication({ ...valid, evidence: 'https://user:password@example.com' }));
  const payload = applicationPayload(valid);
  assert.equal(payload.UID, '123456');
  assert.equal(payload.申请原因, valid.reason);
  assert.equal(Object.hasOwn(payload, 'email'), false);
});

test('activation and mail provider failures are never treated as submitted applications', () => {
  assert.equal(submissionResult({ success: 'true', message: 'Email sent.' }), 'accepted');
  assert.equal(submissionResult({ success: 'false', message: 'This form needs Activation.' }), 'activation');
  assert.throws(() => submissionResult({ success: false, message: 'Rejected.' }));
  assert.throws(() => submissionResult({}));
});
