import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, copy, ctx, adapterNames } from './fixtures/transfer-harness.mjs';

const writable = plan => ['planned', 'success'].includes(plan.status);
const sorted = value => [...value].sort();
const sameSet = (actual, expected) => assert.deepEqual(sorted(copy(actual)), sorted(expected));
const attempt = (adapter, root, plan, context = ctx) => adapter.write(root, plan, context)
  .catch(error => ({ status: 'unsupported', reason: error.message }));
function safe(f) {
  assert.equal(f.w.document.getElementById('neighbor').value, 'KEEP');
  assert.deepEqual(copy(f.app.second), []); assert.deepEqual(f.forbidden, []);
  assert.equal(f.R.liveSupportClaimed, false);
}

for (const lib of ['el', 'ant']) {
  test(`${lib} real transfer sets, adds, removes and clears through both directional UI actions`, async t => {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root);
    assert.equal(adapter?.name, adapterNames[lib]);
    for (const [fact, keys, labels] of [
      [{ value: ['Alpha', 'Beta'] }, ['a', 'b'], ['Alpha', 'Beta']],
      [{ operation: 'add', value: ['Keep'] }, ['a', 'b', 'keep'], ['Alpha', 'Beta', 'Keep']],
      [{ operation: 'remove', value: ['Alpha'] }, ['b', 'keep'], ['Beta', 'Keep']],
      [{ value: [] }, [], []],
    ]) {
      const plan = f.R.plan(f.root, fact);
      assert.equal(plan.status, 'planned', JSON.stringify(plan));
      assert.equal(plan.type, 'transfer'); assert.equal(plan.operation, 'set');
      assert.equal(plan.liveSupportClaimed, false); assert.equal(plan.writeStarted, false);
      sameSet(plan.value, keys); sameSet(plan.modelValue, keys); sameSet(plan.domValue, labels);
      const before = f.effects.length;
      assert.equal((await adapter.write(f.root, plan)).reason, 'shadow_mode');
      assert.equal(f.effects.length, before);
      const written = await adapter.write(f.root, plan, ctx);
      assert.equal(written.strategy, 'ui', JSON.stringify(written)); assert.ok(written.attempts > 0);
      sameSet(f.app.value, keys); sameSet(f.rightLabels(), labels);
      const verified = await adapter.verify(f.root, plan, { settleMs: 0 });
      assert.equal(verified.status, 'success', JSON.stringify(verified));
      sameSet(verified.modelReadback, keys); sameSet(verified.domReadback, labels);
      assert.equal(f.R.plan(f.root, { value: keys }).status, 'success');
      const count = f.effects.length;
      assert.equal((await adapter.write(f.root, plan, ctx)).attempts, 0);
      assert.equal(f.effects.length, count); safe(f);
    }
    const clicks = f.effects.filter(event => event.type === 'click');
    assert.ok(clicks.some(event => event.target.closest('.el-transfer__buttons,.ant-transfer-operation')));
    assert.ok(clicks.some(event => event.target.closest('.el-transfer-panel__item,.ant-transfer-list-content-item')));
  });

  test(`${lib} transfer refuses malformed, missing, ambiguous and disabled facts without effects`, async t => {
    const f = await boot(lib); t.after(() => f.close());
    for (const value of [null, '', 'Alpha', {}, [null], [true], ['Missing'], ['Twin'], ['Blocked']])
      assert.equal(writable(f.R.plan(f.root, { value })), false, JSON.stringify(value));
    for (const operation of ['toggle', 'move', 'submit', ''])
      assert.equal(writable(f.R.plan(f.root, { operation, value: ['Alpha'] })), false, operation);
    assert.deepEqual(f.effects, []); sameSet(f.app.value, ['keep']); safe(f);
  });

  test(`${lib} transfer binds plans to the original owner and unedited payload`, async t => {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: ['Alpha'] });
    for (const [root, instruction] of [[f.sibling, plan], [f.root, copy(plan)]]) {
      const written = await adapter.write(root, instruction, ctx);
      assert.equal(written.status, 'unsupported'); assert.equal(written.attempts, 0);
      assert.equal((await adapter.verify(root, instruction, { settleMs: 0 })).status, 'unsupported');
    }
    for (const mutate of [
      plan => { plan.value = ['b']; plan.modelValue = ['b']; plan.domValue = ['Beta']; },
      plan => { plan.domValue = ['Painted']; }, plan => { plan.operation = 'remove'; },
      plan => { plan.type = 'multi-select'; },
    ]) {
      const changed = f.R.plan(f.root, { value: ['Alpha'] }); mutate(changed);
      assert.equal((await adapter.write(f.root, changed, ctx)).status, 'unsupported');
      assert.equal((await adapter.verify(f.root, changed, { settleMs: 0 })).status, 'unsupported');
    }
    assert.deepEqual(f.effects, []); safe(f);
  });

  test(`${lib} transfer honors cancellation and changing readonly state before every effect`, async t => {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: ['Alpha'] });
    await assert.rejects(adapter.write(f.root, plan, { allowWrite: true, check: async () => { throw Error('cancelled'); } }), /cancelled/u);
    assert.deepEqual(f.effects, []);
    f.root.addEventListener('pointerdown', () => f.root.setAttribute('aria-readonly', 'true'), { once: true });
    assert.equal((await attempt(adapter, f.root, plan)).status, 'unsupported');
    assert.equal(f.effects.some(event => event.type === 'click'), false);
    sameSet(f.app.value, ['keep']); safe(f);
    const raced = await boot(lib); t.after(() => raced.close());
    const saved = raced.R.plan(raced.root, { value: ['Alpha'] });
    raced.root.addEventListener('pointerdown', () => {
      raced.root.querySelector('.el-transfer-panel__header input,.ant-transfer-list-header input').checked = true;
    }, { once: true });
    assert.equal((await attempt(raced.R.resolve(raced.root), raced.root, saved)).status, 'unsupported');
    assert.equal(raced.effects.some(event => event.type === 'click'), false); safe(raced);
  });

  test(`${lib} transfer refuses a stale source, active search or another pending checkbox selection`, async t => {
    for (const state of ['source', 'search', 'row', 'header']) {
      const f = await boot(lib, { props: lib === 'el' ? { filterable: true } : { showSearch: true } });
      t.after(() => f.close());
      const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: ['Alpha'] });
      if (state === 'source') { f.app.value = ['b']; await f.tick(); }
      if (state === 'search') f.root.querySelector('input:not([type="checkbox"])').value = 'Alpha';
      if (state === 'row') f.root.querySelector('.el-transfer-panel__item input,.ant-transfer-list-content-item input').checked = true;
      if (state === 'header') f.root.querySelector('.el-transfer-panel__header input,.ant-transfer-list-header input').checked = true;
      assert.equal((await attempt(adapter, f.root, plan)).status, 'unsupported', state);
      assert.deepEqual(f.effects, []); sameSet(f.app.value, state === 'source' ? ['b'] : ['keep']); safe(f);
    }
  });

  test(`${lib} transfer treats unsafe structure, disabled controls and unreviewed versions as passive`, async t => {
    for (const mutation of ['disabled', 'readonly', 'inner-readonly', 'hidden', 'button-hidden', 'label', 'version', 'owner']) {
      const f = await boot(lib); t.after(() => f.close());
      const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: ['Alpha'] });
      if (mutation === 'disabled') { f.app.disabled = true; await f.tick(); }
      if (mutation === 'readonly') f.root.setAttribute('aria-readonly', 'true');
      if (mutation === 'inner-readonly') f.root.querySelector('input').setAttribute('aria-readonly', 'true');
      if (mutation === 'hidden') f.root.hidden = true;
      if (mutation === 'button-hidden') f.root.querySelector('button').hidden = true;
      if (mutation === 'label') {
        const label = f.w.document.createElement('label'); label.htmlFor = 'save'; f.root.before(label); label.append(f.root);
      }
      if (mutation === 'version') {
        const exported = lib === 'el' ? 'ELEMENT' : 'antd'; f.w[exported] = { ...f.w[exported], version: '99.0.0' };
      }
      if (mutation === 'owner') f.root.__vue__ = { ...f.root.__vue__ };
      assert.equal((await attempt(adapter, f.root, plan)).status, 'unsupported', mutation);
      assert.equal((await adapter.verify(f.root, plan, { settleMs: 0 })).status, 'unsupported', mutation);
      assert.deepEqual(f.effects, []); sameSet(f.app.value, ['keep']); safe(f);
    }
  });

  test(`${lib} transfer reads model and visible right list independently and detects delayed reversion`, async t => {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: ['Alpha'] });
    await adapter.write(f.root, plan, ctx);
    assert.equal((await adapter.verify(f.root, plan, { settleMs: 0 })).status, 'success');
    const row = f.right().querySelector(lib === 'el' ? '.el-transfer-panel__item .el-checkbox__label' : '.ant-transfer-list-content-item-text');
    const previous = row.textContent; row.textContent = 'Painted wrong';
    assert.notEqual((await adapter.verify(f.root, plan, { settleMs: 0 })).status, 'success');
    row.textContent = previous;
    f.w.setTimeout(() => { f.app.value = ['keep']; }, 5);
    assert.equal((await adapter.verify(f.root, plan, { settleMs: 20 })).status, 'reverted');
    safe(f);
  });
}

test('Element transfer preserves numeric key types without coercing string codes', async t => {
  const f = await boot('el', { value: [], options: [{ key: 7, label: 'Numeric' }, { key: 's', label: 'String' }] });
  t.after(() => f.close());
  assert.equal(writable(f.R.plan(f.root, { value: ['7'] })), false);
  const plan = f.R.plan(f.root, { value: [7] });
  assert.equal(plan.status, 'planned'); assert.deepEqual(copy(plan.value), [7]);
  await f.R.resolve(f.root).write(f.root, plan, ctx);
  const result = await f.R.verify(f.root, plan, { settleMs: 0 });
  assert.equal(result.status, 'success'); assert.deepEqual(copy(result.modelReadback), [7]);
  safe(f);
});
