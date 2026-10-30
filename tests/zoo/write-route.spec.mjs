import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo } from './support.mjs';

for (const scenario of ['legacy', 'native', 'ud-select']) {
  const enabled = scenario !== 'legacy';
  test(`ordinary RESUME_FILL uses ${enabled ? `opt-in packaged ${scenario} writer` : 'default legacy path'}`, async ({}, testInfo) => {
    const zoo = await startZoo('write-route');
    try {
      const profile = { schemaVersion: 1, fullName: '离线姓名', confirmedFields: ['fullName'] };
      const profileBinding = await zoo.bind(profile);
      if (scenario === 'ud-select') await zoo.page.evaluate(() => {
        // Readonly/search displays must enter the ordinary route only after
        // MAIN identifies a writable, version-confirmed widget model.
        const input = document.querySelector('#fullName');
        input.readOnly = true; input.type = 'search'; input.setAttribute('role', 'combobox');
        input.setAttribute('aria-controls', 'route-name-options');
        window.UD = { version: 'fixture-contract-1' };
        const portal = document.createElement('div'); portal.id = 'route-name-options';
        portal.setAttribute('role', 'listbox'); portal.hidden = true;
        const option = document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = '离线姓名';
        portal.append(option); document.body.append(portal);
        const props = { value: '', options: [{ value: 'name-code', label: '离线姓名' }],
          onChange(value) { props.value = value; input.value = '离线姓名'; portal.hidden = true; } };
        const host = { type: 'input', stateNode: input };
        const fiber = { type: { displayName: 'UdSelect', library: { name: 'ud', version: 'fixture-contract-1' } },
          memoizedProps: props, child: host, return: null };
        host.return = fiber;
        input.__reactFiber$zoo = fiber;
        input.addEventListener('click', () => { portal.hidden = false; });
        option.addEventListener('click', () => props.onChange('name-code'));
      });
      if (enabled) await zoo.worker.evaluate(() => chrome.storage.local.set({ resumeAtsEngineWriteEnabled: true }));
      await zoo.inject(['src/core/matcher.js', 'src/core/domain-memory.js', 'src/content/engine.js']);
      const result = await zoo.worker.evaluate(async ({ tabId, profile, profileBinding }) => chrome.tabs.sendMessage(tabId,
        { type: 'RESUME_FILL', profile, profileBinding }), { tabId: zoo.tabId, profile, profileBinding });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(await zoo.page.locator('#fullName').inputValue()).toBe('离线姓名');
      const field = result.data.fields.find(row => row.profilePath === 'fullName' || row.path === 'fullName' || row.question === '姓名');
      expect(field, JSON.stringify(result)).toBeTruthy();
      expect(field.status, JSON.stringify(result)).toBe('verified');
      if (enabled) {
        expect(field.adapter, JSON.stringify(result)).toBe(scenario === 'ud-select' ? 'ud-select' : 'native-text');
        expect(field.adapterStatus).toBe('success');
      }
      else expect(field.adapter).toBeUndefined();
      const evidence = await zoo.evidence();
      expect(evidence).toMatchObject({ nonGetObserved: 0, responseToNonGet: 0, nonGetBlocked: 0,
        blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false, liveSupportClaimed: false });
      expect(evidence.routing.rejected).toEqual([]);
      expect(await zoo.page.locator('#neighbor').inputValue()).toBe('ZOO_NEIGHBOR_KEEP');
      await fs.writeFile(testInfo.outputPath('write-route-evidence.json'), JSON.stringify({ scenario, enabled, result, evidence }, null, 2));
    } finally { await zoo.close(); }
  });
}
