import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const page = 'https://fixture.example.test/resume';
const customQuestion = '兴趣方向';
const profile = {
  schemaVersion: 1, email: 'synthetic@example.test',
  education: [{ school: 'SYNTHETIC_SCHOOL', degree: 'SYNTHETIC_DEGREE', major: 'SYNTHETIC_FINANCE' }],
  customFacts: [{ question: customQuestion, answer: 'SYNTHETIC_FOCUS', sitePageUrl: page,
    sectionName: 'form:single', rowContext: 'none' }],
  customAnswers: { [customQuestion]: 'SYNTHETIC_FOCUS' },
  confirmedFields: ['email', 'education.0.school', 'education.0.degree', 'education.0.major', `customAnswers.${customQuestion}`],
};
const labels = { school: '学校', degree: '学历', major: '专业', custom: customQuestion };
const valueFor = key => key === 'custom' ? profile.customAnswers[customQuestion] : profile.education[0][key];
const pathFor = key => key === 'custom' ? `customAnswers.${customQuestion}` : `education.0.${key}`;
const nativeRow = key => `<div class="form-item"><div class="form-item-title">${labels[key]}</div>
  <select id="${key}"><option value="">请选择</option><option>${valueFor(key)}</option></select></div>`;

// Public DOM contracts only: one hashed component root, a nested menu without
// ARIA roles, and separate query/committed-display nodes. No private framework
// state, production identifiers, live selectors, or synthetic success receipts.
function fixture(t, { key = 'major', mode = 'custom', lazy = true, open = false,
  asyncReplacement = false, mountOnQuery = false, requireFocus = false, addTag = 'button',
  futureAria = false, unownedSibling = false, unsafe = '', conflict = '', onBinding } = {}) {
  const desired = valueFor(key), label = labels[key];
  const addition = `<${addTag} id="add" ${addTag === 'button' ? `type="${unsafe === 'submit' ? 'submit' : 'button'}"` : ''}><span>添加${label}全称</span></${addTag}>`;
  const widget = `<div class="form-item" id="target-row"><div class="form-item-title">${label}</div>
    <div class="answer-column"><div class="fixture-Tooltip-container-a1"><div id="target-widget" class="fixture-Dropdown-container-b2">
      <label><span id="target-display" class="fixture-Input-display-value-c3 fixture-Input-display-value-spacing-d4"></span>
        <input id="target" placeholder="请选择"></label>
      <div id="target-menu" class="fixture-Dropdown-dropdown-e5" hidden><div class="fixture-Select-menu-f6">
        <div id="items" class="fixture-Select-scrollable-g7"><span>暂无选项</span></div>
        <div id="add-area"><span>没有找到？</span>${addition}</div>
      </div></div>
    </div></div></div></div>`;
  const education = ['school', 'degree', 'major'].map(field => field === key ? widget : nativeRow(field)).join('');
  const dom = new JSDOM(`<!doctype html><body><form>
    <label for="email">邮箱</label><input id="email" type="email">
    <fieldset data-repeat-kind="education"><legend>教育经历</legend>${education}</fieldset>
    ${key === 'custom' ? widget : ''}
    <div class="fixture-Dropdown-container-neighbor"><label><span class="fixture-Input-display-value-neighbor">KEEP_LABEL</span>
      <input id="neighbor" value="KEEP"></label><div class="fixture-Dropdown-dropdown-neighbor" hidden>
      <button id="neighbor-add" type="button">添加${label}全称</button></div></div>
    <button id="save" type="button">保存</button><button id="submit" type="submit">提交</button>
    <button id="edit" type="button">编辑简历</button><button id="create" type="button">新建简历</button>
  </form></body>`, { url: page, runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document, effects = [], network = [], listeners = [];
  const input = d.getElementById('target'), root = d.getElementById('target-widget');
  const menu = d.getElementById('target-menu'), items = d.getElementById('items'), display = d.getElementById('target-display');
  const state = { queries: [], optionClicks: 0, customClicks: 0, committed: '', mounted: false };
  w.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  const forbidden = (...args) => { network.push(args); throw Error('fixture_network_forbidden'); };
  w.fetch = forbidden; w.XMLHttpRequest.prototype.send = forbidden; w.navigator.sendBeacon = forbidden;
  w.HTMLFormElement.prototype.submit = () => { throw Error('fixture_submit_forbidden'); };
  w.HTMLFormElement.prototype.requestSubmit = () => { throw Error('fixture_submit_forbidden'); };
  w.chrome = { storage: { local: { async get() { return {}; }, async set() { throw Error('fixture_storage_write_forbidden'); } } },
    runtime: { id: 'fixture', onMessage: { addListener(listener) { listeners.push(listener); },
      removeListener(listener) { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1); },
      hasListener: listener => listeners.includes(listener), hasListeners: () => listeners.length > 0 },
    async sendMessage(message) {
      assert.equal(message.type, 'RESUME_PROFILE_BINDING_CHECK');
      return await onBinding?.({ w, d, state, effects }) || { allowed: true };
    } } };
  for (const type of ['input', 'change', 'blur', 'click', 'submit'])
    d.addEventListener(type, event => effects.push({ type, target: event.target }), true);
  if (mode === 'no-add') d.getElementById('add-area').remove();
  if (unsafe === 'label') menu.querySelector('#add').setAttribute('aria-label', 'Save');
  if (unsafe === 'write') d.getElementById('add-area').setAttribute('hx-post', '/fixture-write');
  if (futureAria) { menu.setAttribute('role', 'listbox'); input.setAttribute('aria-controls', menu.id); }
  if (unownedSibling) root.parentElement.append(menu);
  if (conflict === 'shared-aria') {
    menu.setAttribute('role', 'listbox'); input.setAttribute('aria-controls', menu.id);
    d.getElementById('neighbor').setAttribute('aria-controls', menu.id);
  } else if (conflict === 'two-editors') {
    const other = d.createElement('input'); other.id = 'other-editor'; other.value = 'KEEP_EDITOR'; root.append(other);
  } else if (conflict === 'two-menus') {
    const other = menu.cloneNode(true); other.id = 'other-menu'; root.append(other);
  }
  if (lazy && !open && !conflict) menu.remove();
  if (open) menu.hidden = false;
  input.addEventListener('click', () => {
    if (!mountOnQuery) {
      if (!menu.isConnected) { root.append(menu); state.mounted = true; }
      menu.hidden = false;
    }
  });
  input.addEventListener('input', () => {
    const dependencyReady = key !== 'major' || ['school', 'degree'].every(field => d.getElementById(field).value === valueFor(field));
    state.queries.push({ value: input.value, dependencyReady });
    if (!dependencyReady || input.value !== desired || requireFocus && d.activeElement !== input) return;
    w.setTimeout(() => {
      if (mountOnQuery && !menu.isConnected) { root.append(menu); state.mounted = true; }
      menu.hidden = false;
      items.replaceChildren();
      const choices = ['exact', 'query-only', 'placeholder-commit'].includes(mode)
        ? ['SYNTHETIC_OTHER_CHOICE', desired] : mode === 'custom' ? ['SYNTHETIC_OTHER_CHOICE'] : [];
      if (!choices.length) { const empty = d.createElement('span'); empty.textContent = '暂无选项'; items.append(empty); }
      for (const choice of choices) {
        const option = d.createElement('div'); option.className = 'fixture-Select-common-item-h8 fixture-Menu-content-item-i9';
        const text = d.createElement('span'); text.textContent = choice; option.append(text);
        option.addEventListener('click', () => {
          state.optionClicks++;
          if (mode !== 'query-only') display.textContent = mode === 'placeholder-commit' ? '暂无选项' : choice;
          input.value = ''; menu.hidden = true;
        });
        items.append(option);
      }
    }, 25);
  });
  menu.querySelector('#add')?.addEventListener('click', () => {
    state.customClicks++;
    const replace = () => {
      const editor = d.createElement('input'); editor.id = 'target'; editor.placeholder = `请输入${label}全称`;
      editor.addEventListener('blur', () => { state.committed = editor.value; });
      root.replaceWith(editor);
    };
    if (asyncReplacement) w.setTimeout(replace, 25); else replace();
  });
  w.eval(source('src/core/matcher.js')); w.eval(source('src/content/engine.js'));
  async function request(type) {
    return await new Promise(resolve => listeners[0]({ type, profile: structuredClone(profile), profileBinding: {} }, { id: 'fixture' }, resolve));
  }
  return { w, d, input, root, menu, display, effects, state, desired, request, async run(type) {
    const result = await request(type); assert.equal(result.ok, true, JSON.stringify(result));
    if (type === 'RESUME_FILL') {
      assert.equal(result.data.liveSupportClaimed, false); assert.equal(result.data.softwareClickedSubmit, false);
      assert.equal(result.data.savedOnSite, null); assert.equal(result.data.submitted, null);
    }
    return result.data;
  }, async inspect() {
    const result = await this.run('RESUME_INSPECT'), field = result.fields.find(row => row.id === 'target');
    assert.deepEqual(effects, []); assert.equal(field.path, pathFor(key), JSON.stringify(field));
    assert.deepEqual([...field.labels], [label]); return field;
  }, safe() {
    assert.equal(d.getElementById('neighbor').value, 'KEEP'); assert.deepEqual(network, []);
    assert.equal(effects.some(({ type, target }) => type === 'submit'
      || target.closest('#save,#submit,#edit,#create,#neighbor-add') || target.id === 'neighbor'), false);
    assert.equal(d.getElementById('other-editor')?.value || 'KEEP_EDITOR', 'KEEP_EDITOR');
  } };
}

const target = result => result.fields.find(field => field.id === 'target');
function verified(h, result) {
  const field = target(result);
  assert.equal(field.status, 'verified', JSON.stringify({ field, state: h.state, editor: h.d.getElementById('target')?.outerHTML })); assert.equal(field.reason, 'readback_matched', JSON.stringify(field));
  assert.equal(field.currentValue, h.desired); assert.equal(/暂无选项/u.test(field.currentValue), false);
  for (const native of result.fields.filter(row => ['email', 'school', 'degree', 'major'].includes(row.id))) {
    assert.equal(native.status, 'verified', JSON.stringify(native)); assert.equal(native.reason, 'readback_matched', JSON.stringify(native));
  }
  assert.ok(h.state.queries.length > 0); assert.ok(h.state.queries.every(query => query.dependencyReady)); h.safe();
}

for (const key of ['school', 'major', 'custom'])
  test(`the same suggestion custom-add contract commits a confirmed ${key} answer`, async t => {
    const h = fixture(t, { key, open: key === 'school' });
    await h.inspect(); const result = await h.run('RESUME_FILL'); verified(h, result);
    assert.equal(h.state.customClicks, 1); assert.equal(h.state.optionClicks, 0);
    assert.equal(h.state.committed, h.desired); assert.equal(h.d.getElementById('target').value, h.desired);
    if (key === 'major') assert.equal(h.state.mounted, true);
  });

test('an exact non-ARIA common-item wins over an available custom-add action', async t => {
  const h = fixture(t, { mode: 'exact' }); await h.inspect();
  verified(h, await h.run('RESUME_FILL'));
  assert.equal(h.state.optionClicks, 1); assert.equal(h.state.customClicks, 0);
  assert.equal(h.display.textContent, h.desired); assert.equal(h.input.value, ''); assert.equal(h.menu.hidden, true);
  assert.equal(h.effects.some(({ type, target: node }) => node === h.input && ['change', 'blur'].includes(type)), false);
});

test('an owned custom-add action may replace its editor asynchronously in the original slot', async t => {
  const h = fixture(t, { asyncReplacement: true }); await h.inspect();
  verified(h, await h.run('RESUME_FILL'));
  assert.equal(h.state.customClicks, 1); assert.equal(h.state.committed, h.desired);
  assert.notEqual(h.d.getElementById('target'), h.input);
});

for (const addTag of ['span', 'div'])
  test(`a unique owned ${addTag} add-full-name entry commits through its local editor`, async t => {
    const h = fixture(t, { addTag }); await h.inspect(); verified(h, await h.run('RESUME_FILL'));
    assert.equal(h.state.customClicks, 1); assert.equal(h.state.committed, h.desired);
  });

test('a uniquely referenced ARIA menu may mount after the query and must own the add action', async t => {
  const h = fixture(t, { futureAria: true, mountOnQuery: true });
  assert.equal(h.menu.isConnected, false); await h.inspect();
  verified(h, await h.run('RESUME_FILL'));
  assert.equal(h.state.customClicks, 1); assert.equal(h.state.committed, h.desired);
});

test('an unreferenced sibling menu cannot supply a matching option or custom-add action', async t => {
  const h = fixture(t, { unownedSibling: true, lazy: false }); await h.inspect();
  const result = await h.run('RESUME_FILL'); assert.notEqual(target(result).status, 'verified');
  assert.equal(h.state.customClicks, 0); assert.equal(h.state.optionClicks, 0);
  assert.equal(h.effects.some(({ type, target: node }) => type === 'click' && h.menu.contains(node)), false); h.safe();
});

for (const requireFocus of [false, true])
  test(`a dependent suggestion mounts its owned menu only after a search query (focus required=${requireFocus})`, async t => {
    const h = fixture(t, { mountOnQuery: true, requireFocus });
    assert.equal(h.menu.isConnected, false); await h.inspect(); assert.equal(h.menu.isConnected, false);
    verified(h, await h.run('RESUME_FILL'));
    assert.equal(h.state.mounted, true); assert.equal(h.state.customClicks, 1); assert.equal(h.state.committed, h.desired);
  });

for (const mode of ['empty-custom', 'no-add', 'query-only', 'placeholder-commit'])
  test(`${mode} suggestion requires a real committed readback`, async t => {
    const h = fixture(t, { mode }); await h.inspect(); const result = await h.run('RESUME_FILL');
    if (mode === 'empty-custom') {
      verified(h, result); assert.equal(h.state.customClicks, 1); assert.equal(h.state.committed, h.desired);
    } else {
      assert.notEqual(target(result).status, 'verified', JSON.stringify(target(result)));
      assert.equal(h.state.customClicks, 0); h.safe();
    }
  });

for (const conflict of ['shared-aria', 'two-editors', 'two-menus'])
  test(`${conflict} ownership conflict receives no query, selection, or add action`, async t => {
    const h = fixture(t, { conflict }); const before = await h.run('RESUME_INSPECT');
    assert.ok(target(before)); assert.deepEqual(h.effects, []);
    const result = await h.run('RESUME_FILL'); assert.notEqual(target(result).status, 'verified');
    assert.deepEqual(h.state.queries, []); assert.equal(h.state.customClicks, 0); assert.equal(h.state.optionClicks, 0);
    assert.equal(h.input.value, ''); assert.equal(h.effects.some(({ target: node }) => node === h.input), false); h.safe();
  });

for (const unsafe of ['submit', 'write', 'label'])
  test(`an add-full-name entry under a ${unsafe} action is never activated`, async t => {
    const h = fixture(t, { unsafe }); await h.inspect(); const result = await h.run('RESUME_FILL');
    assert.notEqual(target(result).status, 'verified'); assert.equal(h.state.customClicks, 0);
    assert.equal(h.effects.some(({ type, target: node }) => type === 'click' && !!node.closest('#add')), false); h.safe();
  });

test('profile denial after the async query prevents custom-add and every later effect', async t => {
  let stoppedAt;
  const h = fixture(t, { onBinding: async ({ w, state, effects }) => {
    if (!state.queries.length) return;
    await new Promise(resolve => w.setTimeout(resolve, 0)); stoppedAt ??= effects.length;
    return { allowed: false };
  } });
  await h.inspect(); const result = await h.request('RESUME_FILL');
  assert.equal(result.ok, false); assert.equal(result.error, 'profile_binding_changed');
  assert.equal(h.state.customClicks, 0); assert.equal(h.state.optionClicks, 0); assert.notEqual(stoppedAt, undefined);
  assert.deepEqual(h.effects.slice(stoppedAt), []); h.safe();
});

test('a custom fact losing its confirmed form scope during replacement receives no value or events', async t => {
  const h = fixture(t, { key: 'custom', asyncReplacement: true, onBinding: ({ d, state, effects }) => {
    if (!state.customClicks || state.scopeChanged) return;
    d.querySelector('form').id = 'changed-scope'; state.scopeChanged = true; state.stoppedAt = effects.length;
  } });
  await h.inspect(); const result = await h.run('RESUME_FILL');
  assert.equal(h.state.scopeChanged, true); assert.equal(h.state.customClicks, 1);
  assert.notEqual(target(result).status, 'verified'); assert.equal(h.state.committed, '');
  assert.equal(h.d.getElementById('target').value, ''); assert.deepEqual(h.effects.slice(h.state.stoppedAt), []); h.safe();
});
