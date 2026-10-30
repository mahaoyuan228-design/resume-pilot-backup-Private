/** Serialized into the pinned MAIN world. Reads only; V8 throwOnSideEffect is mandatory. */
export function readCmsSnapshot() {
  const own = (object, key) => {
    if (!object || !['object', 'function'].includes(typeof object)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
  };
  const copy = (object, keys) => {
    const result = {};
    for (let i = 0; i < keys.length; i += 1) {
      const value = own(object, keys[i]);
      if (['string', 'number', 'boolean'].includes(typeof value) || value === null) result[keys[i]] = value;
    }
    return result;
  };
  const text = value => typeof value === 'string' ? value.replace(/\s+/gu, ' ').replace(/^\s+|\s+$/gu, '') : '';
  const nodes = document.querySelectorAll('*');
  let anchor;
  for (let i = 0; i < nodes.length && !anchor; i += 1) {
    const keys = Object.getOwnPropertyNames(nodes[i]);
    for (let j = 0; j < keys.length; j += 1) {
      if (/^(?:__reactInternalInstance|__reactFiber)\$/u.test(keys[j])) { anchor = own(nodes[i], keys[j]); break; }
    }
  }
  const ancestry = [], pending = [anchor], roots = [];
  while (pending.length && ancestry.length < 2000) {
    const fiber = pending.pop();
    if (!fiber || ancestry.includes(fiber)) continue;
    ancestry.push(fiber);
    if (own(fiber, 'tag') === 3) {
      const current = own(own(fiber, 'stateNode'), 'current');
      if (current && !roots.includes(current)) roots.push(current);
    }
    pending.push(own(fiber, 'return'), own(fiber, 'alternate'));
  }
  if (roots.length !== 1) throw new Error('committed_root_ambiguous');
  const work = [{ fiber: roots[0], parent: null }], fibers = [], parents = [];
  while (work.length && fibers.length < 50000) {
    const entry = work.pop(), fiber = entry.fiber;
    if (!fiber || fibers.includes(fiber)) continue;
    fibers.push(fiber); parents.push(entry.parent);
    const siblings = [];
    for (let child = own(fiber, 'child'); child; child = own(child, 'sibling')) {
      if (siblings.includes(child) || siblings.length >= 10000) throw new Error('fiber_cycle');
      siblings.push(child); work.push({ fiber: child, parent: fiber });
    }
  }
  if (work.length) throw new Error('fiber_limit');
  let template, dictionary;
  const privateStrings = [];
  const remember = value => { if (typeof value === 'string' && value.length > 1 && value.length < 10000 && !privateStrings.includes(value)) privateStrings.push(value); };
  for (let i = 0; i < fibers.length; i += 1) {
    const props = own(fibers[i], 'memoizedProps'), state = own(fibers[i], 'memoizedState');
    const candidate = own(state, 'resumeTpl');
    if (!template && Array.isArray(candidate)) template = candidate;
    const source = own(props, 'dataSource');
    if (!dictionary && source && typeof source === 'object' && own(source, '0/4')) dictionary = source;
    // These values never reach disk. They are exact-match redaction tokens only.
    remember(own(props, 'resumeId'));
    const save = own(props, 'saveData'); remember(own(save, 'resumeId'));
    for (const box of [own(props, 'resumeData'), own(state, 'resumeData')]) {
      remember(own(box, 'id')); remember(own(box, 'resumeName'));
    }
  }
  if (!template || !dictionary) throw new Error('template_or_dictionary_missing');
  const itemKeys = ['itemId','oldItemId','cnName','enName','name','fillType','isNeed','dataSource',
    'customDataSource','isNumber','isSoFar','showAllName','isManageInfo','order','status'];
  const sections = [], referenced = [];
  const flatten = (list, output, depth) => {
    if (!Array.isArray(list) || depth > 5 || list.length > 1000) return;
    for (let i = 0; i < list.length; i += 1) {
      const item = own(list, String(i));
      if (Array.isArray(item)) flatten(item, output, depth + 1);
      else if (item && typeof item === 'object') {
        const metadata = copy(item, itemKeys);
        if (metadata.itemId === undefined) continue;
        metadata.required = metadata.isNeed === 0;
        output.push(metadata);
        const source = metadata.dataSource;
        if (typeof source === 'string' && source.includes('/') && !referenced.includes(source)) referenced.push(source);
      }
    }
  };
  for (let i = 0; i < template.length; i += 1) {
    const section = own(template, String(i));
    const result = copy(section, ['setId','cnName','enName','name','isNeed','isMutiRecord','rowSize','order','status']);
    result.infoItemList = [];
    flatten(own(section, 'infoItemList'), result.infoItemList, 0);
    sections.push(result);
  }
  const dictionaryRows = (array, depth) => {
    const result = [];
    if (!Array.isArray(array) || array.length > 20000 || depth > 12) return result;
    for (let i = 0; i < array.length; i += 1) {
      const row = own(array, String(i));
      const metadata = copy(row, ['code','name','label','value','order']);
      const children = own(row, 'children');
      if (Array.isArray(children)) metadata.children = dictionaryRows(children, depth + 1);
      if (Object.getOwnPropertyNames(metadata).length) result.push(metadata);
    }
    return result;
  };
  const dictionaries = [];
  for (let i = 0; i < referenced.length; i += 1) {
    dictionaries.push({ dataSource: referenced[i], options: dictionaryRows(own(dictionary, referenced[i]), 0) });
  }
  const optionText = child => {
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    if (Array.isArray(child)) { let value = ''; for (let i=0;i<child.length;i+=1) value += optionText(own(child,String(i))); return value; }
    return '';
  };
  const readOptions = options => {
    const result = [];
    if (!Array.isArray(options) || options.length > 20000) return result;
    for (let i = 0; i < options.length; i += 1) {
      const option = own(options, String(i)), props = own(option, 'props');
      if (props && own(own(option,'type'),'isSelectOption') === true) {
        const label = text(optionText(own(props, 'children')));
        if (label) { const item = copy(props, ['value','disabled']); item.label = label; result.push(item); }
      }
    }
    return result;
  };
  const controls = [], items = document.querySelectorAll('.ant-form-item');
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    let wrapperId = '';
    for (let node=item,depth=0;node&&depth<8;node=node.parentElement,depth+=1) {
      const id=node.getAttribute('id');
      if (id && /^\d+_\d+_\d+$/u.test(id)) { wrapperId=id; break; }
    }
    const labelNode = item.querySelector('.ant-form-item-label label') || item.querySelector('label');
    const label = text(labelNode ? labelNode.textContent : '');
    if (!wrapperId) { if (label) throw new Error('unkeyed_labelled_control'); continue; }
    const control = { wrapperId: wrapperId, label: label, options: [], optionsSource: 'none', controlKind: 'text' };
    const picker = item.querySelector('.ant-calendar-picker'), select = item.querySelector('.ant-select');
    if (picker) control.controlKind = 'date';
    else if (select) {
      control.controlKind = item.querySelector('.ant-cascader-picker') ? 'cascader' : 'select';
      let fiber;
      for (let j = 0; j < fibers.length; j += 1) { if (own(fibers[j], 'stateNode') === select) { fiber = fibers[j]; break; } }
      for (let step = 0; fiber && step < 18; step += 1) {
        const props = own(fiber, 'memoizedProps'), options = readOptions(own(props, 'children'));
        if (options.length) { control.options = options; control.optionsSource = 'committed_react_option_definitions'; break; }
        fiber = parents[fibers.indexOf(fiber)];
        if (own(fiber, 'tag') === 5) break;
      }
    } else if (item.querySelector('input[type=radio]')) control.controlKind = 'radio';
    else if (item.querySelector('input[type=checkbox]')) control.controlKind = 'checkbox';
    else if (item.querySelector('textarea')) control.controlKind = 'textarea';
    else if (item.querySelector('input[type=file], .ant-upload')) control.controlKind = 'upload';
    const choices = item.querySelectorAll('.ant-radio-wrapper, .ant-checkbox-wrapper');
    if (choices.length && !control.options.length) {
      for (let j = 0; j < choices.length; j += 1) { const label = text(choices[j].textContent); if (label) control.options.push({ label: label }); }
      control.optionsSource = 'rendered_choice_labels';
    }
    const key = wrapperId.replace(/_\d+$/u, '');
    for (let j = 0; j < sections.length; j += 1) {
      const list = sections[j].infoItemList;
      for (let k = 0; k < list.length; k += 1) {
        if (list[k].itemId === key) {
          control.itemId = key; control.required = list[k].required; control.fillType = list[k].fillType;
          if (!control.options.length && typeof list[k].dataSource === 'string') {
            for (let n = 0; n < dictionaries.length; n += 1) {
              if (dictionaries[n].dataSource === list[k].dataSource && dictionaries[n].options.length) {
                control.options = dictionaries[n].options; control.optionsSource = 'main_world_template_dictionary';
              }
            }
          }
        }
      }
    }
    if (/姓名|名字|名称|证件|手机|电话|邮箱|邮件|身份证/u.test(label) && !/学校|专业|公司|证书|资格|项目/u.test(label)) {
      const inputs = item.querySelectorAll('input,textarea');
      for (let j=0;j<inputs.length;j+=1) remember(inputs[j].getAttribute('value'));
      const selected = item.querySelectorAll('.ant-select-selection-selected-value');
      for (let j=0;j<selected.length;j+=1) remember(text(selected[j].textContent));
    }
    controls.push(control);
  }
  const assets = [];
  const sources = document.querySelectorAll('script[src],link[rel=stylesheet]');
  for (let i = 0; i < sources.length; i += 1) {
    const node = sources[i];
    assets.push({ url: node.getAttribute('src') || node.getAttribute('href'), kind: node.tagName === 'SCRIPT' ? 'script' : 'stylesheet' });
  }
  return { html: document.documentElement.outerHTML, sections: sections, dictionaries: dictionaries, controls: controls,
    assets: assets, privateStrings: privateStrings, schema: { committedFiberCount: fibers.length, formItemCount: items.length,
      keyedFieldCount: controls.length, unlabelledActionRowCount: items.length-controls.length, mainWorld: true } };
}
