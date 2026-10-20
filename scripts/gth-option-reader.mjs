/**
 * Read already-rendered GTH option lists. Hidden nodes count: the live editor
 * keeps picker panels in the DOM with display:none. This function never clicks.
 *
 * Custom picker levels live at
 *   .eo-cascader-panel .eo-cascader-menu.simple-tree-outer
 *     > ul.simple-tree-wrapper > li.branch
 * Level 1 is every li.branch already in the first menu (has-child rows
 * and leaf rows such as 香港/澳门/台湾). Level 2 is only li.branch nodes
 * already rendered in later menus (checkbox label). Nothing here opens
 * another level.
 *
 * Also reads .el-select-dropdown__item, .el-cascader-node, and [role="option"]
 * that are not inside an eo-cascader-panel. Does not claim support.
 */
export const OPTION_TEXT_MAX = 80;
export const OPTION_LEVEL_MAX = 200;

export function readGthOptionLists(roots) {
  const textMax = 80;
  const levelMax = 200;
  const list = Array.isArray(roots) ? roots : [roots];
  const seen = new Set();
  const selectOptions = [];
  const levelOptions = [[], []];

  function norm(value) {
    return String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  }

  function classTokens(node) {
    const out = [];
    for (const token of node?.classList || []) {
      if (token && !out.includes(token)) out.push(token);
      if (out.length >= 16) break;
    }
    return out;
  }

  function pushSelect(node) {
    if (!node || seen.has(node)) return;
    if (typeof node.closest === 'function' && (node.closest('.eo-cascader-panel') || node.closest('li.branch'))) return;
    seen.add(node);
    const text = norm(node.textContent).slice(0, textMax);
    if (!text || selectOptions.length >= levelMax) return;
    selectOptions.push({ text, classes: classTokens(node), level: null });
  }

  function branchText(li, level) {
    if (level === 2) {
      const label = [...li.children].find((node) => node.tagName === 'LABEL') || li.querySelector?.('label');
      if (label) return norm(label.textContent).slice(0, textMax);
    }
    const span = [...li.children].find((node) => node.tagName === 'SPAN');
    return norm(span ? span.textContent : li.textContent).slice(0, textMax);
  }

  function menuBranches(menu) {
    const lists = [...menu.children].filter((node) => node.tagName === 'UL' && node.classList?.contains('simple-tree-wrapper'));
    const items = [];
    for (const list of lists) {
      for (const li of list.children) {
        if (li.tagName === 'LI' && li.classList?.contains('branch')) items.push(li);
      }
    }
    return items;
  }

  function pushLevel(li, level) {
    if (!li || seen.has(li)) return;
    seen.add(li);
    const bucket = levelOptions[level - 1];
    if (bucket.length >= levelMax) return;
    const text = branchText(li, level);
    if (!text) return;
    bucket.push({ text, classes: classTokens(li), level });
  }

  for (const root of list) {
    if (!root || typeof root.querySelectorAll !== 'function') continue;
    for (const node of root.querySelectorAll('.el-select-dropdown__item, .el-cascader-node, [role="option"]')) {
      pushSelect(node);
    }
    const panels = [];
    if (root.nodeType === 1 && typeof root.matches === 'function' && root.matches('.eo-cascader-panel')) panels.push(root);
    for (const panel of root.querySelectorAll('.eo-cascader-panel')) {
      if (!panels.includes(panel)) panels.push(panel);
    }
    for (const panel of panels) {
      const menus = [...panel.querySelectorAll('.eo-cascader-menu.simple-tree-outer')]
        .filter((menu) => menu.closest('.eo-cascader-panel') === panel);
      menus.forEach((menu, index) => {
        const branches = menuBranches(menu);
        if (index === 0) {
          // First menu is level 1: has-child rows, plus leaf rows such as
          // 香港/澳门/台湾 that are already rendered beside them.
          for (const li of branches) pushLevel(li, 1);
          return;
        }
        for (const li of branches) pushLevel(li, 2);
      });
    }
  }

  const levels = [1, 2].map((level) => ({
    level,
    options: levelOptions[level - 1]
  }));
  return {
    selectOptions,
    levels,
    options: [...selectOptions, ...levelOptions[0], ...levelOptions[1]]
  };
}
