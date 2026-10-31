// Offline: basic fill scopes forms to 基本信息 + dismisses foreign editors (never Save).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const basic = await readFile(resolve('src/content/gth-basic.js'), 'utf8');
const probe = await readFile(resolve('src/background/gth-basic-auto.mjs'), 'utf8');

test('gth-basic forms() is basic-section scoped', () => {
  assert.match(basic, /const forms = sections => \[\.\.\.sections\[0\]\.querySelectorAll\('form'\)\]/);
  assert.match(basic, /const otherSectionForms = sections =>/);
  assert.match(basic, /async function clearForeignEditors/);
  assert.match(basic, /other_section_editor_open/);
  assert.match(basic, /norm\(node\.textContent\) === '取消'/);
  assert.doesNotMatch(basic, /const forms = sections => sections\.flatMap\(section=>\[\.\.\.section\.querySelectorAll\('form'\)\]\)/);
  assert.match(basic, /implementationRevision:4/);
});

test('gth-basic never clicks Save while clearing foreign editors', () => {
  const dismissStart = basic.indexOf('async function dismissCancelOnly');
  const trialStart = basic.indexOf('async function trial(');
  const body = basic.slice(dismissStart, trialStart > dismissStart ? trialStart : dismissStart + 2000);
  assert.ok(dismissStart > 0);
  assert.match(body, /cancelButtons|取消/);
  assert.match(body, /dismissCancelOnly/);
  assert.match(body, /clearForeignEditors/);
  assert.doesNotMatch(body, /textContent\) === '保存'/);
  assert.doesNotMatch(body, /'提交'|投递/);
});

test('probe scopes basic forms; other sections warn', () => {
  assert.match(probe, /const forms=\[\.\.\.section\.querySelectorAll\('form'\)\]/);
  assert.match(probe, /warning:'gth_other_section_editor_open'/);
  assert.match(probe, /Only 基本信息 forms count/);
  // Ambiguous only when >1 form inside 基本信息, not leftover other-section forms.
  assert.match(probe, /if\(forms\.length>1\)/);
  assert.doesNotMatch(probe, /forms\.length!==1\|\|forms\[0\]!==form/);
});

test('a closed basic editor never activates edit regardless of its link state', async () => {
  const titles = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
  const cases = [
    ['caption', (link) => { link.textContent = '保存'; }],
    ['href', (link) => { link.setAttribute('href', '/resume/save/'); }],
    ['inert href changed', (link) => { link.setAttribute('href', '#'); }],
    ['disabled', (link) => { link.setAttribute('aria-disabled', 'true'); }],
    ['disabled parent', (link) => { link.parentElement.classList.add('is-disabled'); }],
    ['duplicate', (link) => { link.parentElement.append(link.cloneNode(true)); }],
    ['foreign section', (link, document) => { document.querySelectorAll('.title_')[1].append(link); }],
  ];
  for (const [name, mutate] of cases) {
    // Reuse the existing GTH title/edit shell. No writer fields or new picker
    // structure are needed: the action must stop before this closed editor opens.
    const dom = new JSDOM(`<!doctype html><body>${titles.map((title, index) =>
      `<section class="r-section"><div class="title_">${title}${index === 0 ? '<a class="h-e-btn" id="edit" href="javascript:;">编辑</a>' : ''}</div></section>`).join('')}</body>`,
    { url: 'https://hr.gtht.com/resume/edit/', pretendToBeVisual: true, runScripts: 'dangerously' });
    const { window } = dom;
    const clicks = [];
    let bindingChecks = 0;
    window.Element.prototype.getClientRects = () => [{ width: 8, height: 8 }];
    Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
    window.HTMLElement.prototype.click = function () {
      clicks.push(this.textContent);
      throw new Error('unexpected_click');
    };
    window.chrome = { runtime: {
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
      onMessage: { addListener() {}, removeListener() {} },
      async sendMessage(message) {
        if (message?.type === 'RESUME_PROFILE_BINDING_CHECK' && ++bindingChecks === 2)
          mutate(window.document.getElementById('edit'), window.document);
        return { allowed: true };
      },
    } };
    window.eval(basic);
    try {
      const result = await window.ResumeGthBasic.trial({ requestId: 'basic-editor-drift',
        profileBinding: { version: 1, epoch: 'basic-editor-fixture', profileHash: 'a'.repeat(64) },
        profile: { confirmedFields: [] } });
      assert.deepEqual(clicks, [], name);
      assert.equal(bindingChecks, 1, name);
      assert.equal(result.ok, false, name);
      assert.equal(result.reason, 'manual_open_editor_required', name);
      assert.equal(result.writeStarted, false, name);
      assert.equal(result.softwareClickedSave, false, name);
      assert.equal(result.softwareClickedSubmit, false, name);
      assert.equal(result.softwareClickedDelete, false, name);
      assert.equal(result.liveSupportClaimed, false, name);
    } finally {
      window.close();
    }
  }
});

console.log(JSON.stringify({
  status: 'PASS',
  evidence: 'basic forms scoped + clearForeignEditors cancel-only; probe other-section warn'
}));
