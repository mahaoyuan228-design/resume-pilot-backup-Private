import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const profile = {
  schemaVersion: 1, email: 'synthetic@example.test',
  education: [{ school: 'SYNTHETIC_SCHOOL', degree: 'SYNTHETIC_DEGREE', major: 'SYNTHETIC_FINANCE_MAJOR' }],
  confirmedFields: ['email', 'education.0.school', 'education.0.degree', 'education.0.major'],
};
const desired = profile.education[0].major;
const nativeChoice = key => `<div class="form-item"><div class="form-item-title">${key === 'school' ? '学校' : '学历'}</div>
  <select id="${key}"><option value="">请选择</option><option>${profile.education[0][key]}</option></select></div>`;

// This is a disposable dropdown contract, with no framework internals, live
// selectors or successful write receipts supplied by the fixture. Query text
// and the committed visible label intentionally live in separate DOM nodes.
function fixture(t, { mode = 'search', ariaOption = true, emptyText = '暂无选项', existing = '',
  customAction = 'correct', lazyMenu = false, ariaMenu = false, afterOpen, onBinding, suppliedProfile = profile } = {}) {
  const custom = mode.startsWith('custom');
  const addMarkup = custom ? `<button id="add-major" type="${customAction === 'submit' ? 'submit' : 'button'}">${
    customAction === 'wrong' ? '添加学校全称' : '添加专业全称'}</button>${
    customAction === 'duplicate' ? '<button id="duplicate-add-major" type="button">添加专业全称</button>' : ''}` : '';
  const dom = new JSDOM(`<!doctype html><body><form>
    <label for="email">邮箱</label><input id="email" type="email">
    <fieldset data-repeat-kind="education"><legend>教育经历</legend>
      ${nativeChoice('school')}${nativeChoice('degree')}
      <div class="form-item" id="major-row"><div class="form-item-title">专业</div>
        <div class="answer-column"><div id="major-widget" class="Dropdown-container-fixture">
          <label><span id="major-display" class="Input-display-value-fixture">${existing}</span>
            <input id="major" placeholder="请选择"></label>
          <div id="major-menu" class="Dropdown-dropdown-fixture" hidden>
            <span>${emptyText}</span><p>没有找到专业？</p>
            ${addMarkup}
          </div>
        </div></div>
      </div>
    </fieldset>
    <div class="Dropdown-container-fixture"><label><span class="Input-display-value-fixture">SYNTHETIC_NEIGHBOR</span>
      <input id="neighbor" value="KEEP"></label><div class="Dropdown-dropdown-fixture" hidden>
      <div role="option">${desired}</div><button type="button">添加专业全称</button></div></div>
    <button id="save" type="button">保存</button><button id="submit" type="submit">提交</button>
    <button id="edit" type="button">编辑简历</button><button id="create" type="button">新建简历</button>
  </form></body>`, { url: 'https://fixture.example.test/resume', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document, effects = [], network = [], listeners = [], queries = [];
  const state = { optionClicks: 0, customClicks: 0, customCommitted: '', display: existing };
  w.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  w.fetch = async (...args) => { network.push(args); throw Error('fixture_network_forbidden'); };
  w.XMLHttpRequest.prototype.send = function (...args) { network.push(args); throw Error('fixture_network_forbidden'); };
  w.navigator.sendBeacon = (...args) => { network.push(args); throw Error('fixture_network_forbidden'); };
  w.HTMLFormElement.prototype.submit = () => { throw Error('fixture_submit_forbidden'); };
  w.HTMLFormElement.prototype.requestSubmit = () => { throw Error('fixture_submit_forbidden'); };
  w.chrome = { storage: { local: { async get() { return {}; }, async set() { throw Error('fixture_storage_write_forbidden'); } } },
    runtime: { id: 'fixture', onMessage: { addListener(value) { listeners.push(value); },
      removeListener(value) { const index = listeners.indexOf(value); if (index >= 0) listeners.splice(index, 1); },
      hasListener: value => listeners.includes(value), hasListeners: () => listeners.length > 0 },
    async sendMessage(message) {
      assert.equal(message.type, 'RESUME_PROFILE_BINDING_CHECK');
      return await onBinding?.({ w, d, state, effects, queries }) || { allowed: true };
    } } };
  for (const type of ['input', 'change', 'blur', 'click', 'submit'])
    d.addEventListener(type, event => effects.push({ type, target: event.target }), true);
  const input = d.getElementById('major'), menu = d.getElementById('major-menu'), display = d.getElementById('major-display');
  if (ariaMenu) menu.setAttribute('role', 'listbox');
  if (lazyMenu) menu.remove();
  input.addEventListener('click', () => {
    if (!menu.isConnected) { d.getElementById('major-widget').append(menu); state.menuMounted = true; }
    menu.hidden = false;
    if (afterOpen) d.getElementById('major-widget').setAttribute(afterOpen, 'true');
  });
  input.addEventListener('keydown', event => { if (event.key === 'Escape') menu.hidden = true; });
  input.addEventListener('input', () => {
    const dependencyReady = ['school', 'degree'].every(key => d.getElementById(key).value === profile.education[0][key]);
    queries.push({ value: input.value, dependencyReady });
    if (!dependencyReady || input.value !== desired || custom || mode === 'empty') return;
    w.setTimeout(() => {
      menu.replaceChildren();
      const labels = mode === 'duplicate' ? [desired, desired] : mode === 'partial' ? [`${desired}_EXTENSION`] : [desired];
      for (const label of labels) {
        const option = d.createElement('div'); option.className = 'Select-option-fixture';
        if (ariaOption) option.setAttribute('role', 'option');
        if (mode === 'disabled') option.setAttribute('aria-disabled', 'true');
        option.textContent = label;
        option.addEventListener('click', () => {
          state.optionClicks++;
          if (mode === 'query-only') { menu.hidden = true; return; }
          state.display = mode === 'placeholder-commit' ? emptyText : label;
          display.textContent = state.display;
          input.value = '';
          menu.hidden = true;
          if (mode === 'removed-menu') menu.remove();
          if (mode === 'revert') w.setTimeout(() => { display.textContent = emptyText; state.reverted = true; }, 100);
        });
        if (['option-submit-parent', 'option-write-parent'].includes(mode)) {
          const wrapper = d.createElement(mode === 'option-submit-parent' ? 'button' : 'div');
          if (mode === 'option-submit-parent') wrapper.type = 'submit';
          else wrapper.setAttribute('hx-post', '/fixture-write');
          wrapper.append(option); menu.append(wrapper);
        } else menu.append(option);
      }
    }, 25);
  });
  d.getElementById('add-major')?.addEventListener('click', () => {
    state.customClicks++;
    const editor = d.createElement('input'); editor.id = 'major'; editor.placeholder = '请输入专业全称';
    editor.addEventListener('blur', () => { state.customCommitted = editor.value; });
    if (mode === 'custom-other-record') {
      d.getElementById('major-widget').remove();
      d.getElementById('second-major-slot').append(editor);
    } else if (mode === 'custom-ant-shell') {
      const shell = d.createElement('div'); shell.className = 'ant-select'; shell.append(editor);
      d.getElementById('major-widget').replaceWith(shell);
    } else d.getElementById('major-widget').replaceWith(editor);
    if (mode === 'custom-dialog') {
      const dialog = d.createElement('div'); dialog.setAttribute('role', 'dialog');
      dialog.innerHTML = '<label>专业全称<input id="dialog-major"></label><button type="button">确认</button>';
      d.body.append(dialog);
    }
  });
  d.getElementById('duplicate-add-major')?.addEventListener('click', () => { state.customClicks++; });
  w.eval(source('src/core/matcher.js')); w.eval(source('src/content/engine.js'));
  async function request(type) {
    return await new Promise(resolve => listeners[0]({ type, profile: structuredClone(suppliedProfile), profileBinding: {} }, { id: 'fixture' }, resolve));
  }
  return { w, d, input, menu, display, effects, queries, state, request, async run(type) {
    const result = await request(type);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (type === 'RESUME_FILL') {
      assert.equal(result.data.liveSupportClaimed, false);
      assert.equal(result.data.softwareClickedSubmit, false);
      assert.equal(result.data.savedOnSite, null);
      assert.equal(result.data.submitted, null);
    }
    return result.data;
  }, safe() {
    assert.equal(d.getElementById('neighbor').value, 'KEEP');
    assert.deepEqual(network, []);
    assert.equal(effects.some(({ type, target }) => type === 'submit'
      || target.closest('#save,#submit,#edit,#create') || target.id === 'neighbor'), false);
  } };
}

const byId = (result, id) => result.fields.find(field => field.id === id);
async function inspect(h) {
  const result = await h.run('RESUME_INSPECT');
  assert.deepEqual(h.effects, []);
  const major = byId(result, 'major');
  assert.equal(major.path, 'education.0.major', JSON.stringify(major));
  assert.deepEqual([...major.labels], ['专业']);
  return result;
}
function verified(h, result) {
  for (const key of ['school', 'degree', 'major']) {
    const field = byId(result, key);
    assert.equal(field.status, 'verified', JSON.stringify(field));
    assert.equal(field.reason, 'readback_matched', JSON.stringify(field));
    assert.equal(field.currentValue, profile.education[0][key], JSON.stringify(field));
  }
  assert.equal(byId(result, 'email').status, 'verified');
  assert.equal(result.fields.filter(field => field.status === 'verified').length, 4);
  assert.ok(h.queries.length > 0);
  assert.ok(h.queries.every(query => query.dependencyReady), JSON.stringify(h.queries));
  h.safe();
}

for (const ariaOption of [true, false])
  test(`dependent education major searches an empty menu and verifies a committed exact option (ARIA=${ariaOption})`, async t => {
    const h = fixture(t, { ariaOption });
    await inspect(h);
    const result = await h.run('RESUME_FILL');
    verified(h, result);
    assert.equal(h.state.optionClicks, 1);
    assert.equal(h.display.textContent, desired);
    assert.equal(h.input.value, '');
    assert.equal(h.menu.hidden, true);
    assert.equal(h.effects.some(({ type, target }) => target === h.input && ['change', 'blur'].includes(type)), false,
      'searching uses input only; it must not simulate a committed plain text field');
  });

test('an owned add-full-name action replaces an empty major dropdown with a plain editor and commits on blur', async t => {
  const h = fixture(t, { mode: 'custom' });
  await inspect(h);
  const result = await h.run('RESUME_FILL');
  verified(h, result);
  assert.equal(h.state.customClicks, 1);
  assert.equal(h.state.optionClicks, 0);
  assert.equal(h.d.getElementById('major-widget'), null);
  assert.notEqual(h.d.getElementById('major'), h.input);
  assert.equal(h.d.getElementById('major').value, desired);
  assert.equal(h.state.customCommitted, desired);
});

for (const mode of ['empty', 'duplicate', 'partial', 'disabled', 'query-only', 'placeholder-commit'])
  test(`${mode} major dropdown cannot report the query or empty-state text as a successful selection`, async t => {
    const h = fixture(t, { mode });
    await inspect(h);
    const result = await h.run('RESUME_FILL'), major = byId(result, 'major');
    assert.notEqual(major.status, 'verified', JSON.stringify(major));
    assert.equal(h.state.customClicks, 0);
    if (!['query-only', 'placeholder-commit'].includes(mode)) assert.equal(h.state.optionClicks, 0);
    assert.equal(byId(result, 'school').status, 'verified');
    assert.equal(byId(result, 'degree').status, 'verified');
    h.safe();
  });

test('an already committed different major is preserved without opening or searching its dropdown', async t => {
  const h = fixture(t, { existing: 'SYNTHETIC_EXISTING_MAJOR' });
  await inspect(h);
  const result = await h.run('RESUME_FILL'), major = byId(result, 'major');
  assert.notEqual(major.status, 'verified', JSON.stringify(major));
  assert.equal(major.reason, 'existing_value');
  assert.equal(h.display.textContent, 'SYNTHETIC_EXISTING_MAJOR');
  assert.equal(h.input.value, '');
  assert.deepEqual(h.queries, []);
  assert.equal(h.effects.some(({ target }) => target === h.input || target === h.display), false);
  h.safe();
});

for (const customAction of ['wrong', 'duplicate', 'submit'])
  test(`${customAction} add-full-name action cannot activate a custom editor`, async t => {
    const h = fixture(t, { mode: 'custom', customAction });
    await inspect(h);
    const result = await h.run('RESUME_FILL');
    assert.notEqual(byId(result, 'major').status, 'verified');
    assert.equal(h.state.customClicks, 0);
    assert.equal(h.d.getElementById('major'), h.input);
    assert.equal(h.effects.some(({ type, target }) => type === 'click' && target.matches('#add-major,#duplicate-add-major')), false);
    h.safe();
  });

test('an add-full-name action opening a new dialog leaves its editors and confirmation untouched', async t => {
  const h = fixture(t, { mode: 'custom-dialog' });
  await inspect(h);
  const result = await h.run('RESUME_FILL');
  assert.notEqual(byId(result, 'major').status, 'verified');
  assert.equal(h.state.customClicks, 1);
  assert.equal(h.d.getElementById('major').value, '');
  assert.equal(h.d.getElementById('dialog-major').value, '');
  assert.equal(h.effects.some(({ target }) => target.closest('[role="dialog"]')
    || target === h.d.getElementById('major')), false);
  assert.equal(h.state.customCommitted, '');
  h.safe();
});

test('asynchronous profile denial after the query prevents option selection and all later effects', async t => {
  let stoppedAt;
  const h = fixture(t, { onBinding: async ({ w, effects, queries }) => {
    if (!queries.length) return;
    await new Promise(resolve => w.setTimeout(resolve, 0));
    stoppedAt ??= effects.length;
    return { allowed: false };
  } });
  await inspect(h);
  const response = await h.request('RESUME_FILL');
  assert.equal(response.ok, false);
  assert.equal(response.error, 'profile_binding_changed');
  assert.equal(h.state.optionClicks, 0);
  assert.equal(h.state.customClicks, 0);
  assert.notEqual(stoppedAt, undefined);
  assert.deepEqual(h.effects.slice(stoppedAt), []);
  h.safe();
});

const twoRecords = {
  ...profile,
  education: [...profile.education, { school: 'SYNTHETIC_SECOND_SCHOOL', degree: 'SYNTHETIC_SECOND_DEGREE', major: 'SYNTHETIC_SECOND_MAJOR' }],
  confirmedFields: [...profile.confirmedFields, 'education.1.school', 'education.1.degree', 'education.1.major'],
};
function secondRecord(h, { emptyMajorSlot = false } = {}) {
  const second = h.d.createElement('fieldset'); second.setAttribute('data-repeat-kind', 'education'); second.id = 'second-record';
  second.innerHTML = `<legend>教育经历</legend>${['school', 'degree'].map(key => `<div class="form-item">
    <label for="second-${key}">${key === 'school' ? '学校' : '学历'}</label>
    <input id="second-${key}" value="${twoRecords.education[1][key]}"></div>`).join('')}
    <div class="form-item"><div class="form-item-title">专业</div><div id="second-major-slot">${emptyMajorSlot ? ''
      : '<input id="second-major" value="SYNTHETIC_SECOND_MAJOR">'}</div></div>`;
  h.d.querySelector('fieldset').after(second);
  return second;
}

test('a record reorder during an asynchronous query guard prevents every subsequent write', async t => {
  let reordered = false, stoppedAt;
  const h = fixture(t, { suppliedProfile: twoRecords, onBinding: async ({ w, d, effects, queries }) => {
    if (!queries.length || reordered) return;
    await new Promise(resolve => w.setTimeout(resolve, 0));
    const first = d.querySelector('fieldset'), second = d.getElementById('second-record');
    first.before(second); reordered = true; stoppedAt = effects.length;
  } });
  secondRecord(h);
  await inspect(h);
  const result = await h.run('RESUME_FILL');
  assert.equal(reordered, true);
  assert.notEqual(byId(result, 'major').status, 'verified');
  assert.equal(h.state.optionClicks, 0);
  assert.equal(h.state.customClicks, 0);
  assert.deepEqual(h.effects.slice(stoppedAt), []);
  assert.equal(h.d.getElementById('second-school').value, twoRecords.education[1].school);
  assert.equal(h.d.getElementById('second-major').value, twoRecords.education[1].major);
  h.safe();
});

for (const conflict of ['multiple targets', 'shared owner'])
  test(`explicit ARIA ${conflict} cannot fall back to the nearby dropdown menu`, async t => {
    const h = fixture(t);
    h.menu.setAttribute('role', 'listbox');
    h.input.setAttribute('aria-controls', conflict === 'multiple targets' ? 'major-menu other-menu' : 'major-menu');
    if (conflict === 'multiple targets') {
      const other = h.d.createElement('div'); other.id = 'other-menu'; other.setAttribute('role', 'listbox'); other.hidden = true;
      h.d.body.append(other);
    } else h.d.getElementById('neighbor').setAttribute('aria-controls', 'major-menu');
    const before = await h.run('RESUME_INSPECT');
    assert.deepEqual(h.effects, []);
    assert.ok(byId(before, 'major'));
    const result = await h.run('RESUME_FILL');
    assert.notEqual(byId(result, 'major').status, 'verified');
    assert.deepEqual(h.queries, []);
    assert.equal(h.input.value, '');
    assert.equal(h.effects.some(({ target }) => target === h.input), false);
    assert.equal(h.state.optionClicks, 0);
    h.safe();
  });

for (const shape of ['two editors', 'two displays', 'nested root'])
  test(`a dropdown containing ${shape} cannot claim a unique major selection`, async t => {
    const h = fixture(t), root = h.d.getElementById('major-widget');
    if (shape === 'two editors') {
      const other = h.d.createElement('input'); other.id = 'other-editor'; other.value = 'KEEP_EDITOR'; root.append(other);
    } else if (shape === 'two displays') {
      const other = h.d.createElement('span'); other.className = 'Input-display-value-fixture'; other.textContent = 'KEEP_DISPLAY'; root.append(other);
    } else {
      const nested = h.d.createElement('div'); nested.className = 'Dropdown-container-fixture';
      root.prepend(nested); nested.append(h.input.parentElement);
    }
    const before = await h.run('RESUME_INSPECT');
    assert.deepEqual(h.effects, []);
    assert.ok(byId(before, 'major'));
    const result = await h.run('RESUME_FILL');
    assert.notEqual(byId(result, 'major').status, 'verified');
    assert.deepEqual(h.queries, []);
    assert.equal(h.input.value, '');
    assert.equal(h.effects.some(({ target }) => target === h.input || target.id === 'other-editor'), false);
    assert.equal(h.d.getElementById('other-editor')?.value || 'KEEP_EDITOR', 'KEEP_EDITOR');
    assert.equal(h.state.optionClicks, 0);
    h.safe();
  });

test('a committed major later reverting to an empty-state display loses successful readback', async t => {
  const h = fixture(t, { mode: 'revert' });
  await inspect(h);
  const result = await h.run('RESUME_FILL');
  assert.equal(h.state.optionClicks, 1, 'a reverted selection must not be clicked again');
  assert.equal(h.state.reverted, true);
  assert.equal(h.display.textContent, '暂无选项');
  assert.notEqual(byId(result, 'major').status, 'verified');
  h.safe();
});

test('a custom editor appearing in another education record receives no value or events', async t => {
  const h = fixture(t, { mode: 'custom-other-record', suppliedProfile: twoRecords });
  secondRecord(h, { emptyMajorSlot: true });
  await inspect(h);
  const result = await h.run('RESUME_FILL');
  assert.equal(h.state.customClicks, 1);
  assert.notEqual(byId(result, 'major').status, 'verified');
  assert.equal(h.d.getElementById('major').value, '');
  assert.equal(h.d.getElementById('major').closest('fieldset').id, 'second-record');
  assert.equal(h.effects.some(({ target }) => target === h.d.getElementById('major')), false);
  assert.equal(h.state.customCommitted, '');
  h.safe();
});

test('a uniquely owned lazy menu mounted by opening the major can search and verify its selection', async t => {
  const h = fixture(t, { lazyMenu: true });
  assert.equal(h.menu.isConnected, false);
  await inspect(h);
  assert.equal(h.menu.isConnected, false, 'inspection cannot mount the menu');
  const result = await h.run('RESUME_FILL');
  verified(h, result);
  assert.equal(h.state.menuMounted, true);
  assert.equal(h.menu.isConnected, true);
  assert.equal(h.state.optionClicks, 1);
  assert.equal(h.display.textContent, desired);
  assert.equal(h.input.value, '');
});

test('a committed major stays verifiable when its option closes by removing the owned menu', async t => {
  const h = fixture(t, { mode: 'removed-menu' });
  await inspect(h);
  const result = await h.run('RESUME_FILL');
  verified(h, result);
  assert.equal(h.state.optionClicks, 1);
  assert.equal(h.menu.isConnected, false);
  assert.equal(h.display.textContent, desired);
  assert.equal(h.input.value, '');
});

test('a lazy owned ARIA listbox mounted on opening is adopted before foreign-overlay checks', async t => {
  const h = fixture(t, { lazyMenu: true, ariaMenu: true });
  await inspect(h);
  assert.equal(h.menu.isConnected, false);
  const result = await h.run('RESUME_FILL');
  verified(h, result);
  assert.equal(h.state.menuMounted, true);
  assert.equal(h.menu.getAttribute('role'), 'listbox');
  assert.equal(h.state.optionClicks, 1);
});

for (const afterOpen of ['aria-disabled', 'aria-busy'])
  test(`a major becoming ${afterOpen} while opening receives no search value or input event`, async t => {
    const h = fixture(t, { afterOpen });
    await inspect(h);
    const result = await h.run('RESUME_FILL');
    assert.notEqual(byId(result, 'major').status, 'verified');
    assert.equal(h.d.getElementById('major-widget').getAttribute(afterOpen), 'true');
    assert.deepEqual(h.queries, []);
    assert.equal(h.input.value, '');
    assert.equal(h.effects.some(({ type, target }) => target === h.input && ['input', 'change', 'blur'].includes(type)), false);
    assert.equal(h.state.optionClicks, 0);
    assert.equal(h.state.customClicks, 0);
    h.safe();
  });

test('a hidden matching display cannot supply committed readback for a query-only major', async t => {
  const h = fixture(t, { mode: 'query-only', existing: desired }); h.display.hidden = true;
  await inspect(h);
  const result = await h.run('RESUME_FILL');
  assert.notEqual(byId(result, 'major').status, 'verified');
  assert.equal(h.display.textContent, desired);
  assert.equal(h.display.hidden, true);
  h.safe();
});

test('custom entry switching to another select shell leaves its query input empty and untouched', async t => {
  const h = fixture(t, { mode: 'custom-ant-shell' });
  await inspect(h);
  const result = await h.run('RESUME_FILL');
  assert.equal(h.state.customClicks, 1);
  assert.notEqual(byId(result, 'major').status, 'verified');
  const query = h.d.getElementById('major');
  assert.notEqual(query, h.input);
  assert.equal(query.closest('.ant-select')?.className, 'ant-select');
  assert.equal(query.value, '');
  assert.equal(h.effects.some(({ target }) => target === query), false);
  assert.equal(h.state.customCommitted, '');
  h.safe();
});

for (const mode of ['option-submit-parent', 'option-write-parent'])
  test(`a matching option under an unsafe ${mode} ancestor is never clicked`, async t => {
    const h = fixture(t, { mode });
    await inspect(h);
    const result = await h.run('RESUME_FILL');
    assert.notEqual(byId(result, 'major').status, 'verified');
    assert.equal(h.state.optionClicks, 0);
    assert.ok(h.menu.querySelector('[role="option"]'), 'the matching option really appeared');
    assert.equal(h.effects.some(({ type, target }) => type === 'click' && h.menu.contains(target)), false);
    h.safe();
  });

for (const change of ['label changed', 'moved outside menu'])
  test(`an awaited binding check finding the selected option ${change} prevents its click`, async t => {
    let seen = 0, changed = false;
    const h = fixture(t, { onBinding: async ({ w, d }) => {
      const option = d.querySelector('#major-menu [role="option"]');
      if (changed || !option || option.textContent !== desired || ++seen < 2) return;
      await new Promise(resolve => w.setTimeout(resolve, 0));
      if (change === 'label changed') option.textContent = 'SYNTHETIC_CHANGED_MAJOR';
      else {
        const outside = d.createElement('div'); outside.id = 'outside-menu'; outside.append(option); d.body.append(outside);
      }
      changed = true;
    } });
    await inspect(h);
    const result = await h.run('RESUME_FILL');
    assert.equal(changed, true);
    assert.equal(h.state.optionClicks, 0);
    assert.notEqual(byId(result, 'major').status, 'verified');
    h.safe();
  });
