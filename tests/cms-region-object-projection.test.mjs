// Offline lock-in for CMS region display projection (fillType 9/15).
// Proves {code,name} objects get unique tree-path display, not raw.name scalar.
// Synthetic fixtures only; no real site, private capture, or network.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const target = resolve('src/content/cms-education-serialization.mjs');
const sourceBytes = await readFile(target);
const sourceSHA = createHash('sha256').update(sourceBytes).digest('hex');
assert.equal(
  sourceSHA,
  '63262cde73ca31e38774718540a0ed3c0972dcbc212ecf461f5de2e69d1c9e87',
  'serialization source must match region-projection overlay SHA'
);

const { readCmsEducationSerialization, verifyEducationSerialization } = await import(
  pathToFileURL(target).href
);

const PAGE =
  'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';

function cities() {
  return [
    {
      name: 'Synthetic Province A',
      code: 'province-a',
      sonDicInfos: [
        { name: 'Synthetic City A', code: 'city-a' },
        { name: 'Synthetic City B', code: 'city-b' }
      ]
    }
  ];
}

function props(overrides = {}) {
  const names = [
    '学校',
    '学历',
    '学位',
    '专业名称',
    '开始时间',
    '结束时间',
    '城市',
    '专业排名',
    '专业描述'
  ];
  const infoData = [
    names.map((name, index) => ({
      itemId: 'f' + (index + 1),
      oldItemId: index + 1,
      name,
      fillType: index === 0 ? 1 : [1, 2, 7].includes(index) ? 4 : index === 6 ? 15 : index === 8 ? 6 : 1,
      isNeed: index === 8 ? 1 : 0,
      customDataSource: index === 0 ? 'school' : '',
      dataSource: index === 6 ? 'cities' : '',
      dataSourceMap: {}
    }))
  ];
  const tree = cities();
  const base = {
    id: '14',
    infoData,
    formData: {
      f1: { code: 'school-1', name: 'Synthetic University' },
      f2: '20',
      f3: 'a',
      f4: 'Synthetic Major',
      f5: '2020-01-01',
      f6: '2024-06-01',
      f7: { code: 'city-a', name: 'City-Name-Only-Would-Fail-Verify' },
      f8: 'rank-1',
      f9: ''
    },
    isMutiRecord: true,
    dataSourceRelevantMap: {
      f2: { '20': '硕士研究生' },
      f3: { a: '硕士' },
      f8: { 'rank-1': '无统计' }
    },
    dataSourceRelevant: { f7: structuredClone(tree) },
    dataSource: { cities: structuredClone(tree) }
  };
  return { ...base, ...overrides, formData: { ...base.formData, ...(overrides.formData || {}) } };
}

function fixture(candidates) {
  const wrappers = Array.from({ length: 9 }, (_, i) => ({ id: `14_${i + 1}_0` }));
  const row = {
    getClientRects: () => [{}],
    querySelectorAll: (selector) => {
      assert.equal(selector, ':scope > div[id]');
      return wrappers;
    }
  };
  const section = {
    id: '14',
    getClientRects: () => [{}],
    querySelector: (selector) => {
      assert.equal(selector, ':scope > .tit-wrap .tit');
      return { textContent: '教育经历必填' };
    },
    querySelectorAll: (selector) => {
      assert.equal(selector, ':scope > .form-cell-right > .form-cell-inner');
      return [row];
    },
    __reactFiber$synthetic: { memoizedProps: candidates[0], return: null }
  };
  if (candidates.length > 1) {
    row.__reactFiber$synthetic = { memoizedProps: candidates[1], return: null };
  }
  return {
    document: {
      querySelectorAll: (selector) => {
        assert.equal(selector, 'form .form-cell');
        return [section];
      }
    },
    location: {
      origin: 'https://wecruit.hotjob.cn',
      pathname: '/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html'
    },
    performance: { timeOrigin: 12345 },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
  };
}

function run(fn, candidates) {
  return JSON.parse(
    JSON.stringify(vm.runInNewContext(`(${fn.toString()})()`, fixture(candidates), { timeout: 1000 }))
  );
}

/** Pre-overlay branch order: object name before fillType 9/15 tree path. */
function oldRegionOrderDisplay(raw, fillType, tree, map) {
  let display = raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    display = raw.name || map[raw.code] || raw.code || '';
  } else if (fillType === 4) {
    display = map[raw] || '';
  } else if (fillType === 9 || fillType === 15) {
    const treePaths = (nodes, wanted, path = []) => {
      const found = [];
      for (const node of Array.isArray(nodes) ? nodes : []) {
        const next = [...path, String(node.name || '')];
        if (String(node.code) === wanted) found.push(next);
        found.push(...treePaths(node.sonDicInfos || node.children, wanted, next));
      }
      return found;
    };
    const paths = treePaths(tree, String(raw?.code || raw || ''));
    display = paths.length === 1 ? paths[0].slice(-2) : null;
  }
  return display;
}

test('object {code,name} region projects unique tree path, not raw.name', () => {
  const proof = run(readCmsEducationSerialization, [props()]);
  assert.equal(proof.ok, true);
  const region = proof.rows[0].fields.find((f) => f.question === '城市');
  assert.deepEqual(region.display, ['Synthetic Province A', 'Synthetic City A']);
  assert.equal(region.serialized, 'city-a');
  assert.equal(proof.serialized.set_14[0].item_7, 'city-a');
  // Old order would have returned the misleading scalar name and failed verify.
  assert.equal(
    oldRegionOrderDisplay(region.raw, 15, cities(), {}),
    'City-Name-Only-Would-Fail-Verify'
  );
});

test('zero or duplicate tree paths stay null; DTO unchanged', () => {
  const base = props();
  const emptyTree = structuredClone(base);
  emptyTree.dataSourceRelevant = { f7: [] };
  emptyTree.dataSource = { cities: [] };
  const emptyProof = run(readCmsEducationSerialization, [emptyTree]);
  assert.equal(emptyProof.rows[0].fields.find((f) => f.question === '城市').display, null);
  assert.equal(emptyProof.serialized.set_14[0].item_7, 'city-a');

  const dup = structuredClone(base);
  const twin = structuredClone(cities());
  twin.push(structuredClone(cities()[0]));
  dup.dataSourceRelevant = { f7: twin };
  dup.dataSource = { cities: twin };
  const dupProof = run(readCmsEducationSerialization, [dup]);
  assert.equal(dupProof.rows[0].fields.find((f) => f.question === '城市').display, null);
  assert.equal(dupProof.serialized.set_14[0].item_7, 'city-a');
});

test('scalar region code still projects the same two-level path', () => {
  const scalar = props({ formData: { f7: 'city-a' } });
  const proof = run(readCmsEducationSerialization, [scalar]);
  const region = proof.rows[0].fields.find((f) => f.question === '城市');
  assert.deepEqual(region.display, ['Synthetic Province A', 'Synthetic City A']);
  assert.equal(region.serialized, 'city-a');
});

test('verifyEducationSerialization accepts region pair when display is tree path', () => {
  const proof = run(readCmsEducationSerialization, [props()]);
  const identity = proof.rows[0].identity;
  const plan = {
    page: PAGE,
    records: [
      {
        profileIndex: 0,
        facts: {
          school: { status: 'ready', path: 'e.0.school', optionText: 'Synthetic University', value: 'Synthetic University' },
          degree: { status: 'ready', path: 'e.0.degree', optionText: '硕士研究生', value: '20' },
          academicDegree: { status: 'ready', path: 'e.0.academicDegree', optionText: '硕士', value: 'a' },
          major: { status: 'ready', path: 'e.0.major', optionText: 'Synthetic Major', value: 'Synthetic Major' },
          startDate: { status: 'ready', path: 'e.0.startDate', optionText: '2020-01-01', value: '2020-01-01' },
          endDate: { status: 'ready', path: 'e.0.endDate', optionText: '2024-06-01', value: '2024-06-01' },
          region: {
            status: 'ready',
            path: 'e.0.region',
            optionText: 'Synthetic Province A / Synthetic City A',
            value: { province: 'Synthetic Province A', city: 'Synthetic City A' }
          },
          gradeRank: { status: 'ready', path: 'e.0.gradeRank', optionText: '无统计', value: 'rank-1' },
          description: { status: 'missing', path: 'e.0.description', reason: 'missing_profile_value' }
        }
      }
    ]
  };
  const bindings = [{ profileIndex: 0, identity }];
  const verified = verifyEducationSerialization(plan, bindings, proof);
  assert.equal(verified.ok, true);
  const regionField = verified.records[0].fields.find((f) => f.key === 'region');
  assert.equal(regionField.status, 'verified');
  assert.equal(regionField.reason, 'react_props_and_serialization_matched');
  const description = verified.records[0].fields.find((f) => f.key === 'description');
  assert.equal(description.status, 'skipped');
  assert.equal(description.required, false);
  // complete requires all required fields verified; description optional empty OK
  assert.equal(verified.complete, true);
});

console.log(
  JSON.stringify({
    status: 'PASS',
    sourceSHA256: sourceSHA,
    evidence: 'offline synthetic DOM/props; region object vs tree path; no real user data'
  })
);
