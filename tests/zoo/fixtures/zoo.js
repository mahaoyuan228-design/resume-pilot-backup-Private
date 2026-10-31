/* Offline fixture only. First-party component configuration and DOM replay.
 * Evidence: tests/cms-row-d-calendar-evidence.test.mjs (16_65_0 / 获得时间),
 * src/content/cms-school-search.js (education school layout),
 * src/content/cms-region.js + tests/fixtures/hotjob-pb-region-probe-dom.json
 * (hotjob dual-select container; first-party dependent province/city behavior),
 * tests/gth-work-fill.test.mjs (work editor and month controls),
 * tests/fixtures/gth-intent-census-dom.mjs + gth-intent-census-20261020.json
 * (plugin-dialog single-selection replay). GTH Element version is fixture-only.
 * No fixtures claim a live site's options, versions or successful filling.
 */
(() => {
  'use strict';
  const name = window.__ZOO_CASE__ || new URL(location.href).searchParams.get('case') || 'cms-month';
  const variant = window.__ZOO_VARIANT__ || new URL(location.href).searchParams.get('variant') || '';
  if (name.startsWith('extended-')) { window.createExtendedZoo(name, variant); return; }
  if (name === 'write-route') { window.createWriteRouteZoo(); return; }
  const titles = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
  const forbidden = ['保存', '提交', '下一步', '投递', '删除'];
  const effects = { blacklistClicks: 0, autosaveAttempts: 0, searchRequests: 0, pluginLevel1: 0, pluginLevel2: 0 };
  const initial = {
    englishExamDate: variant === 'existing' ? '2022-03' : '',
    school: variant === 'existing' ? '虚构原学校' : undefined,
    residence: variant === 'existing' || variant === 'mismatch' ? '上海市' : undefined,
    residenceTwin: variant === 'existing' ? '上海市' : undefined,
    startDate: variant === 'existing' ? '2021-01' : name === 'gth-plugin-picker' ? '2023-01' : '',
    endDate: variant === 'existing' ? '2021-12' : name === 'gth-plugin-picker' ? '2024-06' : '',
    jobCategory: name === 'gth-plugin-picker' ? '' : '投资/证券/基金',
    position: '测试工程师', organization: '离线示例公司', workArea: '', description: '离线职责', industry: '投资/证券/基金',
    companyIntro: '', department: '', reportTo: '', subordinateCount: '', salary: '', leaveReason: '',
    neighbor: 'ZOO_NEIGHBOR_KEEP', disabledValue: 'ZOO_DISABLED_KEEP'
  };
  const disabled = variant === 'disabled';
  const clone = value => JSON.parse(JSON.stringify(value));
  Vue.use(antd);
  Vue.use(ELEMENT);

  // This is a minimal replay of the repository's captured GTH plugin structure,
  // not a replacement for Element Cascader and not a future L1 adapter.
  Vue.component('zoo-gth-picker', {
    props: ['value', 'disabled'],
    data: () => ({ open: false, branch: false }),
    methods: {
      show() { if (!this.disabled) { this.open = true; this.branch = false; } },
      branchClick() { this.branch = true; effects.pluginLevel1 += 1; },
      pick() { effects.pluginLevel2 += 1; this.$emit('input', '投资/证券/基金'); this.open = false; },
      cancel() { this.open = false; }
    },
    template: `<div class="el-form-item__content cascader-wrap">
      <div class="input-l pointer" @click="show"><div class="input-l pointer el-input">
        <input class="el-input__inner" type="text" readonly :disabled="disabled" :value="value">
      </div><span class="el-input__suffix"><span class="el-input__suffix-inner"><i class="el-select__caret el-input__icon el-icon-arrow-up"></i></span></span></div>
      <div class="dialog-wrap plugin-dialog-wrap popover blue" v-show="open">
        <div class="eo-checked-wrap selected-view-outer" style="display:none"><ul class="selected-view-data"><li v-if="value" uid="1313"><p>{{value}}</p><i></i></li></ul><div class="selected-counter"><p>{{value ? '（1/1）' : '（0/1）'}}</p></div></div>
        <div class="search-outer"><div class="search-leaves-outer"><ul class="search-leaves-wrapper"></ul></div><div class="search-input-wrapper"><input class="search-input" placeholder="请输入关键字"><i class="clear-input"></i></div></div>
        <div class="eo-cascader-panel">
          <div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper"><li :class="['branch','has-child',branch?'selected':'']" @click="branchClick"><span>金融/保险</span></li></ul></div>
          <div v-if="branch" class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper"><li class="branch" @click="pick"><label><input type="checkbox">投资/证券/基金</label></li></ul></div>
        </div>
        <div class="pop-foot plugin-dialog-pop-foot" style="display:none"><div class="btn-group-outer"><a class="confirm pop-btn">确定</a><a class="cancel pop-btn" @click="cancel">取消</a></div></div>
        <div class="dialog-search-wrap"></div>
      </div>
    </div>`
  });

  const safetyButtons = `<div class="safety-buttons">${forbidden.map(text => `<button type="button">${text}</button>`).join('')}</div>`;
  const neighbor = `<div class="zoo-neighbors"><input id="neighbor" aria-label="neighbor" v-model="neighbor"><input id="disabled-neighbor" v-model="disabledValue" disabled></div>`;
  const cmsSchool = `<div class="resume-operation-wrap"><div class="resume-content-wrap"><form>
    <section class="form-cell"><div class="tit-wrap"><span class="tit">教育经历必填</span></div><div class="form-cell-right"><div class="form-cell-inner">
      <a-form-item label="学校"><a-select id="school" v-model="school" show-search :filter-option="false" :disabled="disabled" :not-found-content="schoolBusy ? '搜索中' : '无匹配学校'" @search="searchSchool">
        <a-select-option v-for="option in schoolOptions" :key="option" :value="option">{{option}}</a-select-option>
      </a-select></a-form-item>
    </div></div></section>${neighbor}${safetyButtons}</form></div></div>`;
  const cmsMonth = `<div class="resume-operation-wrap"><div class="resume-content-wrap"><form>
    <section id="16" class="form-cell"><div class="tit-wrap"><span class="tit">语言能力</span></div><div class="form-cell-right"><div id="16_65_0" class="form-cell-inner">
      <a-form-item label="获得时间"><a-month-picker id="englishExamDate" v-model="englishExamDate" format="YYYY-MM" value-format="YYYY-MM" placeholder="请选择月份" :input-read-only="true" :disabled="disabled" /></a-form-item>
    </div></div></section>${neighbor}${safetyButtons}</form></div></div>`;
  const hotjobPair = `<div class="resume-operation-wrap"><div class="resume-content-wrap"><form>
    <section class="form-cell"><div class="tit-wrap"><span class="tit">个人基本信息必填</span></div><div class="form-cell-right"><div class="form-cell-inner">
    <a-form-item label="现居住地"><span class="cascader-plugins-wrap">
      <a-select id="residence" v-model="residence" :disabled="disabled"><a-select-option value="北京市">北京市</a-select-option><a-select-option value="上海市">上海市</a-select-option></a-select>
      <a-select id="residence-twin" v-model="residenceTwin" :disabled="disabled || !residence"><a-select-option v-if="residence==='北京市'" value="北京市">北京市</a-select-option><a-select-option v-if="residence==='上海市'" value="上海市">上海市</a-select-option></a-select>
    </span></a-form-item></div></div></section>${neighbor}${safetyButtons}</form></div></div>`;
  function textItem(label, key, tag = 'input') {
    const control = tag === 'textarea'
      ? `<textarea class="el-textarea__inner" v-model="${key}"></textarea>`
      : `<input class="el-input__inner" type="text" v-model="${key}"${key === 'salary' ? ' maxlength="10"' : ''}>`;
    return `<div class="el-form-item"><label class="el-form-item__label">${label}</label><div class="el-form-item__content"><div class="${key === 'salary' ? 'el-input select-l' : tag === 'textarea' ? 'input-l el-textarea' : 'input-l el-input'}">${control}</div>${key === 'salary' ? '<span>元/月</span>' : ''}</div></div>`;
  }
  const gthDates = `<div class="el-form-item" id="dates-item"><label class="el-form-item__label">任职时间</label><div class="el-form-item__content">
    <el-date-picker id="start-date" v-model="startDate" type="month" format="yyyy-MM" value-format="yyyy-MM" :editable="false" :clearable="false" :disabled="disabled" placeholder="开始月份" />
    <el-date-picker id="end-date" v-model="endDate" type="month" format="yyyy-MM" value-format="yyyy-MM" :editable="false" :clearable="false" :disabled="disabled" placeholder="结束月份" />
    </div></div>`;
  const gthPicker = `<div class="el-form-item" id="job-category"><label class="el-form-item__label">职位类别</label><zoo-gth-picker v-model="jobCategory" :disabled="disabled" /></div>`;
  const gthIndustry = `<div class="el-form-item"><label class="el-form-item__label">公司所属行业</label><zoo-gth-picker v-model="industry" :disabled="disabled" /></div>`;
  const gthForm = `<form class="el-form sec-form" id="editor">${textItem('职位名称','position')}${gthPicker}${textItem('公司名称','organization')}${gthDates}${textItem('工作地区','workArea')}${textItem('职责与业绩','description','textarea')}${gthIndustry}${textItem('公司介绍','companyIntro','textarea')}${textItem('所属部门','department')}${textItem('汇报对象','reportTo')}${textItem('下属人数','subordinateCount')}${textItem('薪资','salary')}${textItem('离职原因','leaveReason','textarea')}${neighbor}<button type="button" id="editor-cancel">取消</button><button type="button" id="editor-save">保存</button></form><div class="safety-buttons">${forbidden.filter(text => text !== '保存').map(text => `<button type="button">${text}</button>`).join('')}</div>`;
  const gthShell = titles.map(title => `<section class="r-section"><div class="title_">${title}</div>${title === '工作经验' ? gthForm : ''}</section>`).join('');
  const templates = { 'cms-month': cmsMonth, 'cms-school': cmsSchool, 'hotjob-pair': hotjobPair, 'gth-month-range': gthShell, 'gth-plugin-picker': gthShell };
  if (!templates[name]) throw new Error(`unknown_zoo_case:${name}`);

  const app = new Vue({
    el: '#app',
    data: () => ({ ...initial, disabled, schoolBusy: false, schoolOptions: initial.school ? [initial.school] : [], schoolSearchEpoch: 0 }),
    methods: {
      searchSchool(query) {
        effects.searchRequests += 1;
        const epoch = ++this.schoolSearchEpoch;
        this.schoolBusy = true;
        this.schoolOptions = [];
        setTimeout(() => {
          if (epoch !== this.schoolSearchEpoch) return;
          this.schoolOptions = query ? [query, `${query}（相似名称）`] : [];
          this.schoolBusy = false;
        }, 150);
      }
    },
    template: `<main id="app" v-cloak>${templates[name]}</main>`
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('button,a,input[type=submit]');
    if (button && forbidden.includes(button.textContent.trim())) effects.blacklistClicks += 1;
  }, true);
  document.addEventListener('submit', event => event.preventDefault(), true);
  const model = () => Object.fromEntries(Object.keys(initial).map(key => [key, app[key] == null ? '' : app[key]]));
  window.__zoo = {
    ready: false, case: name, variant, liveSupportClaimed: false,
    versions: { vue: Vue.version, antDesignVue: antd.version, elementUi: ELEMENT.version, elementVersionEvidence: 'fixture-selected; live version unknown' },
    readModel: model,
    snapshot: () => ({ model: clone(model()), effects: clone(effects), versions: { vue: Vue.version, antDesignVue: antd.version, elementUi: ELEMENT.version }, liveSupportClaimed: false }),
    triggerAutosave: async () => {
      effects.autosaveAttempts += 1;
      try { await fetch('/zoo-autosave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ synthetic: true }) }); return { blocked: false }; }
      catch { return { blocked: true }; }
    },
    reset: () => location.reload()
  };
  Vue.nextTick(() => { window.__zoo.ready = true; });
})();
