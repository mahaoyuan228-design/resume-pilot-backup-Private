import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, labels, options, copy, ctx, adapterNames } from './fixtures/tree-select-harness.mjs';

function safe(f) {
  assert.equal(f.w.document.querySelector('#neighbor').value, 'KEEP');
  assert.equal(f.app.second, undefined);
  assert.deepEqual(f.forbidden, []);
  assert.equal(f.R.liveSupportClaimed, false);
}

for (const lib of ['ant', 'el', 'plus']) {
  test(`${lib} real tree-select maps a node label to a scalar code, clicks it and verifies both readbacks`, async t => {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: labels[2] });
    assert.equal(adapter?.name, adapterNames[lib]);
    assert.equal(plan.status, 'planned', JSON.stringify(plan));
    assert.equal(plan.type, 'tree-select'); assert.equal(plan.value, 30);
    assert.equal(plan.modelValue, 30); assert.equal(plan.domValue, labels[2]);
    assert.equal(plan.liveSupportClaimed, false); assert.equal(plan.writeStarted, false);
    assert.deepEqual(f.effects, []);
    assert.equal((await adapter.write(f.root, plan)).reason, 'shadow_mode');
    await assert.rejects(adapter.write(f.root, plan, { allowWrite: true, check: async () => { throw Error('guard'); } }), /guard/u);
    assert.deepEqual(f.effects, []);
    const result = await adapter.write(f.root, plan, ctx);
    assert.equal(result.strategy, 'ui', JSON.stringify(result));
    assert.deepEqual(f.clicks, [labels[2]]);
    assert.equal(f.app.value, 30);
    const verified = await adapter.verify(f.root, plan, { settleMs: 0 });
    assert.equal(verified.status, 'success', JSON.stringify(verified));
    assert.equal(verified.modelReadback, 30); assert.equal(verified.domReadback, labels[2]);
    assert.equal(f.R.plan(f.root, { value: labels[2] }).status, 'success');
    const count = f.effects.length;
    assert.equal((await adapter.write(f.root, plan, ctx)).reason, 'preexisting_same_value');
    assert.equal(f.effects.length, count);
    f.paint('painted wrong');
    assert.equal((await adapter.verify(f.root, plan, { settleMs: 0 })).status, 'mismatch');
    f.paint(labels[2]); f.app.value = 31; await f.tick(); f.paint(labels[2]);
    assert.equal((await adapter.verify(f.root, plan, { settleMs: 0 })).status, 'mismatch');
    assert.equal((await adapter.verify(f.root, plan, { settleMs: 0, previousSuccess: true })).status, 'reverted');
    f.app.value = 30; await f.tick();
    f.w.setTimeout(() => { f.app.value = 31; }, 5);
    assert.equal((await adapter.verify(f.root, plan, { settleMs: 20 })).status, 'reverted');
    safe(f);
  });

  test(`${lib} tree-select binds executable plans to the original owner and rejects serialized copies`, async t => {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: labels });
    assert.equal(plan.status, 'planned', JSON.stringify(plan));
    assert.equal(plan.value, 30);
    for (const [target, instruction] of [[f.sibling, plan], [f.root, copy(plan)]]) {
      const result = await adapter.write(target, instruction, ctx);
      assert.equal(result.status, 'unsupported'); assert.equal(result.attempts, 0);
      assert.equal((await adapter.verify(target, instruction, { settleMs: 0 })).status, 'unsupported');
    }
    assert.deepEqual(f.effects, []); assert.equal(f.app.value, undefined); safe(f);
  });

  test(`${lib} tree-select refuses unknown, ambiguous and disabled nodes without effects`, async t => {
    const f = await boot(lib); t.after(() => f.close());
    const fail = value => assert.ok(!['planned', 'success'].includes(f.R.plan(f.root, { value }).status), JSON.stringify(value));
    for (const value of ['', null, [], {}, '未知节点', '浙江省 / 杭州市 / 西湖区', ['未知节点', labels[2]]]) fail(value);
    f.app.options[0].children[0].children[0].disabled = true; await f.tick(); fail(labels[2]);
    f.app.options = options(); f.app.options[0].disabled = true; await f.tick(); fail(labels[2]);
    f.app.options = options(); f.app.options.push({ value: 40, key: 40, label: labels[2], title: labels[2] }); await f.tick();
    fail(labels[2]);
    assert.equal(f.R.plan(f.root, { value: labels }).value, 30, 'an explicit ancestor path disambiguates duplicate leaf labels');
    f.app.options = options(); f.app.disabled = true; await f.tick(); fail(labels[2]);
    f.app.disabled = false; f.app.value = 31; await f.tick(); fail(labels[2]);
    assert.equal(f.app.value, 31); assert.deepEqual(f.effects, []); safe(f);
  });

  test(`${lib} tree-select rechecks node and owner state after pointerdown before selecting`, async t => {
    for (const mutation of ['disabled', 'label', 'detached', 'version', 'existing']) {
      const f = await boot(lib); t.after(() => f.close());
      const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: labels[2] });
      let changed = false;
      f.w.document.addEventListener('pointerdown', event => {
        const item = event.target.closest?.('.ant-select-tree-node-content-wrapper,.el-tree-node__content');
        const text = item?.querySelector('.ant-select-tree-title,.el-tree-node__label,[role="option"] span')?.textContent;
        if (changed || text !== labels[2] || event.target.closest('.ant-select-tree-switcher,.el-tree-node__expand-icon')) return;
        changed = true;
        if (mutation === 'disabled') f.app.disabled = true;
        if (mutation === 'label') {
          f.app.options[0].children[0].children[0].label = 'changed';
          f.app.options[0].children[0].children[0].title = 'changed';
        }
        if (mutation === 'detached') item.replaceWith(item.cloneNode(true));
        if (mutation === 'version') {
          const exported = lib === 'ant' ? 'antd' : lib === 'plus' ? 'ElementPlus' : 'ELEMENT';
          f.w[exported] = { ...f.w[exported], version: '99.0.0' };
        }
        if (mutation === 'existing') f.app.value = 31;
      }, true);
      const result = await adapter.write(f.root, plan, ctx).catch(error => ({ status: 'unsupported', reason: error.message }));
      assert.equal(changed, true, `${lib}: ${mutation}: ${JSON.stringify(result)}`);
      assert.equal(result.status, 'unsupported', `${lib}: ${mutation}: ${JSON.stringify(result)}`);
      assert.deepEqual(f.clicks, [], `${lib}: ${mutation}`);
      assert.equal(f.app.value, mutation === 'existing' ? 31 : undefined); safe(f);
    }
  });
}

test('unreviewed tree-select modes never fall through to a nested plain select/input', async t => {
  for (const [lib, props] of [
    ['ant', { multiple: true }], ['ant', { treeCheckable: true }], ['ant', { labelInValue: true }],
    ['ant', { loadData() {} }], ['ant', { treeDataSimpleMode: true }],
    ['el', { multiple: true }], ['el', { remote: true }],
    ['plus', { multiple: true }], ['plus', { showCheckbox: true }], ['plus', { lazy: true, load() {} }],
  ]) {
    const f = await boot(lib, { props }); t.after(() => f.close());
    const before = copy(f.app.value); // A real multi-select may normalize its empty model during mount.
    for (const target of [f.root, ...(f.input ? [f.input] : [])]) {
      const plan = f.R.plan(target, { value: labels[2] });
      assert.ok(!['planned', 'success'].includes(plan.status), `${lib}: ${Object.keys(props)}: ${JSON.stringify(plan)}`);
    }
    assert.deepEqual(f.effects, []); assert.deepEqual(copy(f.app.value), before); safe(f);
  }
});

test('tree-select plans cannot be edited into authority for a different node or display', async t => {
  for (const lib of ['ant', 'el', 'plus']) {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root);
    for (const edit of [
      plan => { plan.value = 31; plan.modelValue = 31; plan.domValue = '余杭区'; },
      plan => { plan.value = '30'; plan.modelValue = '30'; },
      plan => { plan.domValue = 'painted'; },
    ]) {
      const plan = f.R.plan(f.root, { value: labels[2] }); edit(plan);
      const result = await adapter.write(f.root, plan, ctx);
      assert.equal(result.status, 'unsupported', `${lib}: ${JSON.stringify(result)}`);
      assert.equal(result.attempts, 0);
      assert.equal((await adapter.verify(f.root, plan, { settleMs: 0 })).status, 'unsupported');
    }
    assert.equal(f.app.value, undefined); assert.deepEqual(f.effects, []); safe(f);
  }
});

test('unsupported tree library versions are passive and cannot borrow nested input contracts', async t => {
  for (const lib of ['ant', 'el', 'plus']) {
    const f = await boot(lib); t.after(() => f.close());
    const exported = lib === 'ant' ? 'antd' : lib === 'plus' ? 'ElementPlus' : 'ELEMENT';
    f.w[exported] = { ...f.w[exported], version: '99.0.0' };
    for (const target of [f.root, ...(f.input ? [f.input] : [])]) {
      const adapter = f.R.resolve(target);
      assert.ok(!adapter || adapter.type === 'tree-select', 'the whole tree family stays reserved against plain-input fallback');
      assert.equal(f.R.plan(target, { value: labels[2] }).status, 'manual', lib);
    }
    assert.deepEqual(f.effects, []); safe(f);
  }
});

test('typed tree search text and externally painted selections cannot verify an unclicked plan', async t => {
  for (const lib of ['ant', 'el', 'plus']) {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: labels[2] });
    (lib === 'ant' ? f.root.querySelector('.ant-select-selection') : f.input).click();
    await f.tick();
    const input = lib === 'ant' ? f.w.document.querySelector('.ant-select-dropdown-search input') : f.input;
    Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype, 'value').set.call(input, labels[2]);
    input.dispatchEvent(new f.w.Event('input', { bubbles: true })); await f.tick();
    assert.notEqual((await adapter.verify(f.root, plan, { settleMs: 0 })).status, 'success', lib);
    f.app.value = 30; await f.tick();
    if (lib === 'plus') {
      Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype, 'value').set.call(input, '');
      input.dispatchEvent(new f.w.Event('input', { bubbles: true })); await f.tick();
      f.root.querySelector('.el-select__placeholder').classList.remove('is-transparent');
    }
    f.paint(labels[2]);
    assert.equal(adapter.readModel(f.root).value, 30);
    assert.equal(adapter.readModel(f.root).domValue, labels[2]);
    assert.notEqual((await adapter.verify(f.root, plan, { settleMs: 0 })).status, 'success', `${lib}: no node click`);
    assert.deepEqual(f.clicks, []); safe(f);
  }
});

test('tree-select refuses duplicate, replaced and sibling popup ownership before a node click', async t => {
  for (const lib of ['ant', 'el', 'plus']) for (const mutation of ['duplicate', 'replace', 'sibling']) {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: labels[2] });
    let changed = false;
    const result = await adapter.write(f.root, plan, { allowWrite: true, check: async () => {
      if (changed) return;
      const panel = [...f.w.document.querySelectorAll('.ant-select-tree-dropdown,.el-select-dropdown')]
        .find(node => f.w.getComputedStyle(node).display !== 'none' && !node.closest('[aria-hidden="true"]'));
      if (!panel) return;
      changed = true;
      if (mutation === 'duplicate') f.w.document.body.append(panel.cloneNode(true));
      else if (mutation === 'replace') panel.replaceWith(panel.cloneNode(true));
      else (lib === 'ant' ? f.sibling.querySelector('.ant-select-selection') : f.sibling.querySelector('input')).click();
      await f.tick();
    } }).catch(error => ({ status: 'unsupported', reason: error.message }));
    assert.equal(changed, true, `${lib}: ${mutation}: ${JSON.stringify(result)}`);
    assert.equal(result.status, 'unsupported', `${lib}: ${mutation}: ${JSON.stringify(result)}`);
    assert.deepEqual(f.clicks, []); assert.equal(f.app.value, undefined); safe(f);
  }
});

test('tree codes preserve their observed scalar type and ambiguous labels never infer a code', async t => {
  for (const lib of ['ant', 'el', 'plus']) {
    const f = await boot(lib); t.after(() => f.close());
    assert.equal(f.R.plan(f.root, { value: 30 }).value, 30);
    assert.ok(!['planned', 'success'].includes(f.R.plan(f.root, { value: '30' }).status));
    f.app.options[0].children[0].children[0].value = '30';
    await f.tick();
    const numeric = f.R.plan(f.root, { value: 30 }), text = f.R.plan(f.root, { value: '30' });
    assert.ok(!['planned', 'success'].includes(numeric.status)); assert.equal(text.value, '30');
    assert.equal(text.domValue, labels[2]);
    f.app.options[0].children[0].children.push({ value: 30, key: 'numeric-30', label: 'Numeric code', title: 'Numeric code' });
    await f.tick();
    assert.ok(!['planned', 'success'].includes(f.R.plan(f.root, { value: labels[2] }).status), 'stringified library key collisions remain manual');
    assert.deepEqual(f.effects, []); safe(f);
  }
});

function externalSubmitLabel(f, node) {
  const button = f.w.document.querySelector('button[type="submit"]'); button.id = 'external-submit';
  const label = f.w.document.createElement('label'); label.htmlFor = button.id;
  node.before(label); label.append(node);
  return label;
}

test('a tree root inside a label associated with an external submit button remains passive', async t => {
  for (const lib of ['ant', 'el', 'plus']) {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), original = f.R.plan(f.root, { value: labels[2] });
    assert.equal(original.status, 'planned');
    externalSubmitLabel(f, f.root);
    const next = f.R.plan(f.root, { value: labels[2] });
    assert.ok(!['planned', 'success'].includes(next.status), `${lib}: ${JSON.stringify(next)}`);
    const result = await adapter.write(f.root, original, ctx);
    assert.equal(result.status, 'unsupported'); assert.equal(result.attempts, 0);
    assert.deepEqual(f.effects, []); assert.equal(f.app.value, undefined); safe(f);
  }
});

test('label activation and inserted action controls stop a tree selection after pointerdown', async t => {
  for (const lib of ['ant', 'el', 'plus']) for (const mutation of ['panel-label', 'row-label', 'content-label', 'button-child']) {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: labels[2] });
    let changed = false, pointerTarget;
    f.w.document.addEventListener('pointerdown', event => {
      const content = event.target.closest?.('.ant-select-tree-node-content-wrapper,.el-tree-node__content');
      const text = content?.querySelector('.ant-select-tree-title,.el-tree-node__label,[role="option"] span')?.textContent;
      if (changed || text !== labels[2] || event.target.closest('.ant-select-tree-switcher,.el-tree-node__expand-icon')) return;
      changed = true; pointerTarget = event.target;
      if (mutation === 'panel-label') externalSubmitLabel(f, content.closest('.ant-select-tree-dropdown,.el-select-dropdown'));
      else if (mutation === 'row-label') externalSubmitLabel(f, content.closest('[role="treeitem"]'));
      else if (mutation === 'content-label') externalSubmitLabel(f, content);
      else {
        const button = f.w.document.createElement('button'); button.type = 'submit'; button.textContent = '提交';
        button.addEventListener('click', () => f.forbidden.push('inserted-business-button'));
        content.append(button);
      }
    }, true);
    const result = await adapter.write(f.root, plan, ctx).catch(error => ({ status: 'unsupported', reason: error.message }));
    assert.equal(changed, true, `${lib}: ${mutation}: ${JSON.stringify(result)}`);
    assert.equal(result.status, 'unsupported', `${lib}: ${mutation}: ${JSON.stringify(result)}`);
    assert.equal(f.effects.some(event => ['mousedown', 'mouseup', 'click'].includes(event.type) && event.target === pointerTarget), false);
    assert.deepEqual(f.clicks, []); assert.equal(f.app.value, undefined); safe(f);
  }
});

test('an explicitly nonterminal node without loaded children cannot be treated as a leaf', async t => {
  for (const lib of ['ant', 'el', 'plus']) for (const key of ['isLeaf', 'leaf']) {
    const data = options(); data[0].children[0].children[0][key] = false;
    const f = await boot(lib, { options: data }); t.after(() => f.close());
    const plan = f.R.plan(f.root, { value: labels[2] });
    assert.ok(!['planned', 'success'].includes(plan.status), `${lib}: ${key}: ${JSON.stringify(plan)}`);
    assert.deepEqual(f.effects, []); assert.equal(f.app.value, undefined); safe(f);
  }
  for (const lib of ['el', 'plus']) {
    const data = options(); data[0].children[0].children[0].terminal = false;
    const mapping = { label: 'label', children: 'children', disabled: 'disabled', isLeaf: 'terminal' };
    const f = await boot(lib, { options: data, ...(lib === 'el' ? { treeProps: mapping } : { props: { props: mapping } }) });
    t.after(() => f.close());
    const plan = f.R.plan(f.root, { value: labels[2] });
    assert.ok(!['planned', 'success'].includes(plan.status), `${lib}: declared terminal mapping: ${JSON.stringify(plan)}`);
    assert.deepEqual(f.effects, []); assert.equal(f.app.value, undefined); safe(f);
  }
});
