import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sources = ['model', 'registry', 'native'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const prose = '  Ａ e\u0301\tfirst  line\r\nsecond\r\n\r\nlast\r';
const expected = prose.replace(/\r\n?/gu, '\n');

function boot(t, html = '<textarea id="area"></textarea><div id="rich" contenteditable="true"></div>') {
  const dom = new JSDOM(`<!doctype html><body><form>${html}<input id="neighbor" value="KEEP"><button>提交</button><button type="button">保存</button></form>`,
    { url: 'https://offline.example/', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  for (const source of sources) w.eval(source);
  const events = [];
  for (const type of ['input', 'change', 'blur', 'click', 'submit']) w.document.addEventListener(type, event => events.push([type, event.target.id]));
  return { w, R: w.ResumeControls, get: id => w.document.getElementById(id), events,
    ctx: { allowWrite: true, check: async () => {} } };
}

for (const [id, name] of [['area', 'native-textarea'], ['rich', 'native-richtext']]) {
  test(`${name} preserves prose, uses gated events and reads exact line endings`, async t => {
    const f = boot(t), el = f.get(id), adapter = f.R.resolve(el), plan = f.R.plan(el, { value: prose });
    assert.equal(adapter.name, name);
    assert.equal(plan.status, 'planned');
    assert.equal(plan.liveSupportClaimed, false);
    assert.equal(f.R.liveSupportClaimed, false);
    assert.equal((await adapter.write(el, plan)).reason, 'shadow_mode');
    assert.deepEqual(f.events, []);
    await adapter.write(el, plan, f.ctx);
    const result = await adapter.verify(el, plan, { settleMs: 0 });
    assert.equal(result.status, 'success');
    assert.equal(result.modelReadback, expected);
    assert.equal(result.domReadback, expected);
    assert.deepEqual(f.events, [['input', id], ['change', id], ['blur', id]]);
    assert.equal(f.get('neighbor').value, 'KEEP');
    f.events.length = 0;
    const same = f.R.plan(el, { value: prose });
    assert.equal(same.reason, 'preexisting_same_value');
    assert.equal((await adapter.write(el, same, f.ctx)).attempts, 0);
    assert.deepEqual(f.events, []);
  });

  test(`${name} detects line/space/Unicode loss and delayed reversion`, async t => {
    const f = boot(t), el = f.get(id), adapter = f.R.resolve(el), plan = f.R.plan(el, { value: prose });
    const set = value => { if (id === 'area') el.value = value; else el.textContent = value; };
    for (const wrong of [expected.replace('\n', ' '), expected.replace('  line', ' line'), expected.trim(), expected.normalize('NFKC')]) {
      set(wrong);
      assert.equal((await adapter.verify(el, plan, { settleMs: 0 })).status, 'mismatch');
      assert.equal(f.R.plan(el, { value: prose }).reason, 'existing_value');
    }
    set(expected);
    f.w.setTimeout(() => set('reverted'), 5);
    assert.equal((await adapter.verify(el, plan, { settleMs: 20 })).status, 'reverted');
    assert.equal((await adapter.verify(el, plan, { previousSuccess: true })).status, 'reverted');
    assert.deepEqual(f.events, []);
  });

  test(`${name} protects whitespace data and binds plans to the original root`, async t => {
    const f = boot(t), el = f.get(id), adapter = f.R.resolve(el), plan = f.R.plan(el, { value: prose });
    const other = el.cloneNode(); el.after(other);
    assert.equal((await adapter.write(other, plan, f.ctx)).reason, 'control_target_changed');
    assert.equal((await adapter.verify(other, plan, { settleMs: 0 })).reason, 'control_target_changed');
    if (id === 'area') el.value = ' \n'; else el.textContent = ' \n';
    assert.equal(f.R.plan(el, { value: prose }).reason, 'existing_value');
    assert.equal((await adapter.write(el, plan, f.ctx)).reason, 'existing_value');
    assert.equal(adapter.readModel(el).value, ' \n');
    assert.deepEqual(f.events, []);
  });

  test(`${name} stops if prose appears during an awaited guard`, async t => {
    const f = boot(t), el = f.get(id), adapter = f.R.resolve(el), plan = f.R.plan(el, { value: prose });
    let checks = 0;
    // The first registry check completes before the final per-effect check.
    await assert.rejects(adapter.write(el, plan, { allowWrite: true, async check() {
      if (++checks === 2) { if (id === 'area') el.value = 'user edit'; else el.textContent = 'user edit'; }
    } }), /existing_value/u);
    assert.equal(adapter.readModel(el).value, 'user edit');
    assert.deepEqual(f.events, []);
  });

  test(`${name} refuses inconsistent plan channels and type before effects`, async t => {
    const f = boot(t), el = f.get(id), adapter = f.R.resolve(el);
    for (const [key, value] of [['modelValue', 'changed'], ['domValue', 'changed'], ['type', 'text']]) {
      const plan = f.R.plan(el, { value: prose });
      plan[key] = value;
      assert.equal((await adapter.write(el, plan, f.ctx)).reason, 'invalid_instruction');
      assert.equal((await adapter.verify(el, plan, { settleMs: 0 })).reason, 'invalid_instruction');
      assert.equal(adapter.readModel(el).value, '');
      assert.deepEqual(f.events, []);
    }
  });
}

test('textarea rejects oversized/non-string facts and DOM guards before effects', async t => {
  const f = boot(t, '<textarea id="limited" maxlength="3"></textarea><textarea id="readonly" readonly></textarea><fieldset disabled><textarea id="disabled"></textarea></fieldset>');
  assert.equal(f.R.plan(f.get('limited'), { value: 'four' }).reason, 'value_too_long');
  for (const value of [12, true, ['text'], { text: 'text' }]) assert.equal(f.R.plan(f.get('limited'), { value }).reason, 'invalid_text_value');
  assert.equal(f.R.plan(f.get('readonly'), { value: 'a' }).reason, 'readonly');
  assert.equal(f.R.plan(f.get('disabled'), { value: 'a' }).reason, 'disabled');
  assert.deepEqual(f.events, []);
});

test('richtext reads paragraphs, explicit breaks, blank paragraphs and inline formatting', async t => {
  const f = boot(t, '<div id="rich" contenteditable><p>first <b>bold</b><br>line</p><p><br></p><p>last</p></div>');
  const el = f.get('rich'), adapter = f.R.resolve(el);
  assert.equal(adapter.readModel(el).domValue, 'first bold\nline\n\nlast');
  const plan = f.R.plan(el, { value: 'first bold\r\nline\r\n\r\nlast' });
  assert.equal(plan.status, 'success');
  await adapter.write(el, plan, f.ctx);
  assert.equal((await adapter.verify(el, plan, { settleMs: 0 })).status, 'success');
  assert.ok(el.querySelector('b'), 'matching formatted content remains intact');
  assert.deepEqual(f.events, []);
});

test('richtext empty placeholder accepts literal HTML-like text without creating markup', async t => {
  for (const editable of ['true', '', 'plaintext-only']) {
    const f = boot(t, `<div id="rich" contenteditable="${editable}"><p><br></p></div>`), el = f.get('rich');
    const text = '<img src=x onerror="throw 1">\n<script>literal</script>';
    const adapter = f.R.resolve(el), plan = f.R.plan(el, { value: text });
    assert.equal(plan.status, 'planned');
    await adapter.write(el, plan, f.ctx);
    assert.equal(f.R.helpers.richtextValue(el), text);
    assert.equal(el.querySelector('img,script'), null);
    assert.equal(el.querySelectorAll('br').length, 1);
    assert.equal((await adapter.verify(el, plan, { settleMs: 0 })).status, 'success');
  }
});

test('richtext requires a safe explicit editing host and leaves unknown runtimes manual', t => {
  const cases = [
    '<div id="rich" role="textbox" aria-multiline="true"></div>',
    '<div id="rich" contenteditable="false"></div>',
    '<div contenteditable="true"><div id="rich" contenteditable="true"></div></div>',
    '<div class="ant-editor"><div id="rich" contenteditable="true"></div></div>',
    '<div id="rich" contenteditable="true"><input value="keep"></div>',
    '<div id="rich" contenteditable="true"><span contenteditable="false">keep</span></div>',
    '<div id="rich" contenteditable="true"><span hidden>keep</span></div>',
    '<div id="rich" contenteditable="true"><span style="display:none">keep</span></div>',
    '<div id="rich" contenteditable="true" style="display:flex"></div>',
    '<div id="rich" contenteditable="true"><div style="display:inline">keep</div></div>',
    '<div id="rich" contenteditable="true"><span style="display:block">keep</span></div>',
    '<div id="rich" contenteditable="true"><iframe></iframe></div>',
    '<div id="rich" contenteditable="true" aria-readonly="true"></div>',
    '<div aria-disabled="true"><div id="rich" contenteditable="true"></div></div>',
    '<div id="rich" contenteditable="true" data-captcha></div>',
  ];
  for (const html of cases) {
    const f = boot(t, html);
    assert.ok(!['planned', 'success'].includes(f.R.plan(f.get('rich'), { value: 'text' }).status), html);
    assert.deepEqual(f.events, []);
  }
  const f = boot(t), el = f.get('rich');
  el.__vue__ = { $el: el, $options: { name: 'UnknownEditor' }, $props: { value: '' } };
  assert.equal(f.R.resolve(el), null);
});

test('richtext retains paragraph boundaries without inventing comment or empty-inline lines', t => {
  for (const html of [
    '<section>a</section><article>b</article>',
    '<div>a</div><!--comment--><div>b</div>',
    '<div>a</div><span></span><div>b</div>',
    '<p>a</p><b><i></i></b><p>b</p>',
  ]) {
    const f = boot(t, `<div id="rich" contenteditable="true">${html}</div>`), el = f.get('rich');
    assert.equal(f.R.inspect(el).model.domValue, 'a\nb');
    assert.equal(f.R.plan(el, { value: 'a\nb' }).status, 'success');
    assert.equal(f.R.plan(el, { value: 'a\n\nb' }).reason, 'existing_value');
  }
});

test('richtext preserves a BR inside inline formatting as a real line break', t => {
  for (const tag of ['span', 'b', 'em']) {
    const f = boot(t, `<div id="rich" contenteditable="true">a<${tag}><br></${tag}>b</div>`), el = f.get('rich');
    assert.equal(f.R.inspect(el).model.domValue, 'a\nb');
    assert.equal(f.R.plan(el, { value: 'ab' }).reason, 'existing_value');
  }
  for (const [html, value] of [
    ['<div>a<br></div><div>b</div>', 'a\n\nb'],
    ['<div>a</div><br><div>b</div>', 'a\n\n\nb'],
  ]) {
    const f = boot(t, `<div id="rich" contenteditable="true">${html}</div>`), el = f.get('rich');
    assert.equal(f.R.inspect(el).model.domValue, value);
    assert.equal(f.R.plan(el, { value }).status, 'success');
  }
});

test('richtext serializes newline-only and terminal blank lines with explicit BR nodes', async t => {
  for (const value of ['\n', '\n\n', 'first\n\n']) {
    const f = boot(t), el = f.get('rich'), plan = f.R.plan(el, { value });
    await f.R.resolve(el).write(el, plan, f.ctx);
    assert.equal(el.querySelectorAll('br').length, value.split('\n').length - 1);
    assert.equal((await f.R.verify(el, plan, { settleMs: 0 })).domReadback, value);
    assert.equal((await f.R.verify(el, plan, { settleMs: 0 })).status, 'success');
  }
});

test('reinjection replaces revision 11 prose contracts and installs the richtext family once', t => {
  const f = boot(t), old = f.R;
  f.w.ResumeControls = { version: 1, revision: 11, list: () => [{ name: 'native-text' }] };
  for (const source of sources) f.w.eval(source);
  const current = f.w.ResumeControls;
  assert.notEqual(current, old);
  assert.equal(current.revision, 13);
  assert.equal(current.resolve(f.get('rich')).name, 'native-richtext');
  for (const source of sources) f.w.eval(source);
  assert.equal(f.w.ResumeControls, current);
  assert.equal(current.list().filter(row => row.name === 'native-richtext').length, 1);
});

test('richtext readback rejects a changed editing host, shape, or owner', async t => {
  for (const mutate of [
    el => el.setAttribute('contenteditable', 'false'),
    el => el.innerHTML = '<input value="text">',
    el => el.setAttribute('aria-readonly', 'true'),
    el => { el.__vue__ = { $el: el, $options: { name: 'UnknownEditor' }, $props: { value: 'text' } }; },
    el => el.remove(),
  ]) {
    const f = boot(t), el = f.get('rich'), adapter = f.R.resolve(el), plan = f.R.plan(el, { value: 'text' });
    await adapter.write(el, plan, f.ctx);
    mutate(el);
    assert.equal((await adapter.verify(el, plan, { settleMs: 0 })).status, 'unsupported');
  }
});
