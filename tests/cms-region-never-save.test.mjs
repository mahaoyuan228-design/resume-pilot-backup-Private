// Offline only. Reuse the existing education fixture's cascader and public
// wrappers; mutations below remove links/change values on those same controls.
// This proves fixture behavior, not live tenant support or server persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { integrationFixture } from './fixtures/cms-education-fixture.mjs';

const source = await readFile('src/content/cms-region.js', 'utf8');
const page = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const catalog = {
  schools: ['Fictional School'],
  regions: [{ province: '虚构省甲', city: '虚构市甲' }]
};
const html = await integrationFixture(catalog);
const plain = value => JSON.parse(JSON.stringify(value));

function fixture(t) {
  let elapsed = 0;
  const dom = new JSDOM(html, {
    url: page + '?resumeId=offline', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      window.structuredClone = structuredClone;
      const schedule = window.setTimeout.bind(window);
      window.setTimeout = (work, delay = 0, ...args) => schedule(() => {
        elapsed += delay;
        work(...args);
      }, Math.min(delay, 1));
      Object.defineProperty(window.performance, 'now', { value: () => elapsed });
      window.HTMLElement.prototype.getClientRects = function () {
        return this.isConnected && !this.hidden && !this.closest('[hidden]')
          && window.getComputedStyle(this).display !== 'none' ? [{}] : [];
      };
      window.fetch = () => { throw Error('offline_only'); };
      window.XMLHttpRequest = class { constructor() { throw Error('offline_only'); } };
    }
  });
  const { window } = dom;
  t.after(() => window.close());
  const forbidden = [];
  window.document.addEventListener('click', event => {
    if (event.target.closest('button,input[type="submit"],a')) {
      forbidden.push(event.target.textContent);
      throw Error('forbidden_site_action');
    }
  }, true);
  window.eval(source);
  const wrap = window.document.getElementById('region-host-0');
  const widget = window.fixtureWidgets.regions[0];
  const fact = {
    ...catalog.regions[0], confirmed: true, sitePageUrl: page,
    sectionName: '教育经历必填', question: '城市', rowContext: 'single'
  };
  t.after(() => {
    assert.deepEqual(forbidden, []);
    assert.equal(window.fixtureCounts.saves, 0);
    assert.equal(window.fixtureCounts.submits, 0);
  });
  return { window, wrap, widget, fact, api: window.ResumeCmsRegion };
}

function assertNoActions(f) {
  const state = f.widget.snapshot();
  assert.deepEqual(plain(state.opens), { province: 0, city: 0 });
  assert.deepEqual(plain(state.selections), { province: 0, city: 0 });
  assert.equal(state.menuCount, 0);
  assert.equal(f.window.fixtureCounts.adds, 0);
}

test('occupied region pairs are preserved before any menu or option click', async t => {
  for (const [province, city] of [
    ['虚构省乙', ''], ['虚构省甲', '虚构市乙'], ['', '虚构市乙']
  ]) {
    await t.test(`${province}/${city}`, async t => {
      const f = fixture(t);
      f.widget.setExisting(province, city);
      const before = plain(f.window.fixtureSnapshot());
      assert.deepEqual(plain(await f.api.fillRegion(f.wrap, f.fact)), {
        status: 'skipped', reason: 'existing_value', partial: false
      });
      assert.deepEqual(plain(f.window.fixtureSnapshot()), before);
      assertNoActions(f);
    });
  }
});

test('matching region pair verifies without reopening or reapplying', async t => {
  const f = fixture(t);
  f.widget.setExisting(f.fact.province, f.fact.city);
  assert.deepEqual(plain(await f.api.fillRegion(f.wrap, f.fact)), {
    status: 'verified', reason: 'preexisting_same_value', partial: false, selectedLevels: 0
  });
  assertNoActions(f);
});

test('an existing fixture date popup blocks region without touching either widget', async t => {
  const f = fixture(t);
  f.window.document.getElementById('date-start-0').querySelector('input').click();
  await new Promise(resolve => f.window.setTimeout(resolve, 10));
  assert.equal(f.window.document.querySelectorAll('.ant-calendar-picker-container').length, 1);
  const before = plain(f.window.fixtureSnapshot());
  assert.deepEqual(plain(await f.api.fillRegion(f.wrap, f.fact)), {
    status: 'skipped', reason: 'control_busy', partial: false
  });
  assert.deepEqual(plain(f.window.fixtureSnapshot()), before);
  assertNoActions(f);
});

test('scope and confirmation mismatches fail before opening a region control', async t => {
  for (const change of [
    { confirmed: false }, { province: '' }, { city: '' },
    { sitePageUrl: page + '?other=1' }, { sectionName: '个人基本信息必填' },
    { question: '籍贯' }, { rowContext: 'multiple' }
  ]) {
    await t.test(JSON.stringify(change), async t => {
      const f = fixture(t);
      assert.deepEqual(plain(await f.api.fillRegion(f.wrap, { ...f.fact, ...change })), {
        status: 'failed', reason: 'unconfirmed_or_incomplete_region_pair', partial: false
      });
      assertNoActions(f);
    });
  }
});

test('a matching province survives city miss with explicit zero-selection diagnostics', async t => {
  const f = fixture(t);
  f.widget.setExisting(f.fact.province, '');
  f.widget.setOptions('city', ['虚构市乙']);
  const result = await f.api.fillRegion(f.wrap, f.fact);
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'region_option_not_found');
  assert.equal(result.activeLevel, 'city');
  assert.equal(result.partial, false);
  assert.equal(result.selectedLevels, 0);
  const state = f.widget.snapshot();
  assert.equal(state.province, f.fact.province);
  assert.equal(state.city, '');
  assert.deepEqual(plain(state.opens), { province: 0, city: 1 });
  assert.deepEqual(plain(state.selections), { province: 0, city: 0 });
  assert.equal(state.menuCount, 0);
});

test('city miss after province rerender reports partial selection and closes its menu', async t => {
  const f = fixture(t);
  f.widget.setOptions('city', ['虚构市乙']);
  const result = await f.api.fillRegion(f.wrap, f.fact);
  assert.equal(result.reason, 'region_option_not_found');
  assert.equal(result.partial, true);
  assert.equal(result.selectedLevels, 1);
  assert.equal(result.activeLevel, 'city');
  const state = f.widget.snapshot();
  assert.equal(state.province, f.fact.province);
  assert.equal(state.city, '');
  assert.deepEqual(plain(state.selections), { province: 1, city: 0 });
  assert.equal(state.menuCount, 0);
  assert.equal(f.window.document.querySelectorAll('.ant-select-open').length, 0);
  const diagnostic = f.api.diagnostics();
  assert.equal(diagnostic.reason, 'region_option_not_found');
  assert.equal(diagnostic.partial, true);
  assert.equal(JSON.stringify(diagnostic).includes(f.fact.province), false);
  assert.equal(JSON.stringify(diagnostic).includes(f.fact.city), false);
});

test('missing owned aria link cannot fall back to the visible global menu', async t => {
  const f = fixture(t);
  f.wrap.querySelector('.ant-select-selection').removeAttribute('aria-controls');
  const result = await f.api.fillRegion(f.wrap, f.fact);
  assert.equal(result.reason, 'menu_link_missing_or_ambiguous');
  assert.equal(result.partial, false);
  assert.deepEqual(plain(f.widget.snapshot().selections), { province: 0, city: 0 });
  assert.equal(f.widget.snapshot().menuCount, 0);
});

test('neighbor mutation during menu opening stops before selecting an option', async t => {
  const f = fixture(t);
  f.wrap.querySelector('.ant-select-selection').addEventListener('click', () => {
    f.window.document.getElementById('unrelated').value = 'changed externally';
  }, { once: true });
  const result = await f.api.fillRegion(f.wrap, f.fact);
  assert.equal(result.reason, 'field_or_neighbor_changed');
  assert.equal(result.selectedLevels, 0);
  assert.deepEqual(plain(f.widget.snapshot().selections), { province: 0, city: 0 });
  assert.equal(f.window.document.getElementById('unrelated').value, 'changed externally');
});

test('same-slot cascader rerender during owner check rebinds before clicking', async t => {
  const f = fixture(t);
  const oldSelection = f.wrap.querySelector('.ant-select-selection');
  const originalCheck = () => {
    f.widget.setExisting('', '');
    f.window.ResumeProfileWriteContext = { check: async () => {} };
  };
  f.window.ResumeProfileWriteContext = { check: async () => originalCheck() };
  const result = await f.api.fillRegion(f.wrap, f.fact);
  assert.equal(oldSelection.isConnected, false);
  assert.equal(result.status, 'verified');
  assert.equal(result.reason, 'readback_matched');
  assert.equal(result.selectedLevels, 2);
  assert.deepEqual(plain(f.widget.snapshot().selections), { province: 1, city: 1 });
});

test('neighbor change during option owner check stops before selecting', async t => {
  const f = fixture(t);
  let checks = 0;
  f.window.ResumeProfileWriteContext = { check: async () => {
    if (++checks === 2) f.window.document.getElementById('unrelated').value = 'changed during check';
  } };
  const result = await f.api.fillRegion(f.wrap, f.fact);
  assert.equal(result.reason, 'field_or_neighbor_changed');
  assert.equal(result.selectedLevels, 0);
  assert.deepEqual(plain(f.widget.snapshot().selections), { province: 0, city: 0 });
});

test('changed or disabled option during owner check cannot be clicked', async t => {
  for (const mutate of [
    option => { option.textContent = '虚构省乙'; },
    option => { option.setAttribute('aria-disabled', 'true'); }
  ]) {
    await t.test(mutate.toString(), async t => {
      const f = fixture(t);
      let checks = 0;
      f.window.ResumeProfileWriteContext = { check: async () => {
        if (++checks === 2) mutate(f.window.document.querySelector('.ant-select-dropdown-menu-item'));
      } };
      const result = await f.api.fillRegion(f.wrap, f.fact);
      assert.equal(result.reason, 'candidate_changed');
      assert.equal(result.selectedLevels, 0);
      assert.deepEqual(plain(f.widget.snapshot().selections), { province: 0, city: 0 });
      assert.equal(f.widget.snapshot().menuCount, 0);
    });
  }
});

test('owned Escape includes visible typeless input and excludes hidden text input', async t => {
  for (const typeless of [true, false]) {
    await t.test(typeless ? 'typeless visible' : 'explicit hidden', async t => {
      const f = fixture(t);
      const input = f.wrap.querySelector('input');
      if (typeless) {
        input.removeAttribute('type');
        input.style.display = '';
      }
      let escapes = 0;
      input.addEventListener('keydown', event => {
        if (event.target !== input || event.key !== 'Escape') return;
        assert.equal(event.keyCode, 27);
        assert.equal(event.which, 27);
        escapes++;
      });
      f.widget.setOptions('province', ['虚构省乙']);
      const result = await f.api.fillRegion(f.wrap, f.fact);
      assert.equal(result.reason, 'region_option_not_found');
      assert.equal(escapes, typeless ? 1 : 0);
      assert.equal(f.widget.snapshot().menuCount, 0);
      assert.deepEqual(plain(f.widget.snapshot().selections), { province: 0, city: 0 });
    });
  }
});
