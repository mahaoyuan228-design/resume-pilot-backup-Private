// First-party generic date contracts. Detection reads attributes only: no
// handler evaluation, calendar opening, field inference or site selectors.
(() => {
  'use strict';
  const R = globalThis.ResumeControls;
  if (!R) throw Error('control_registry_missing');
  if (R.list().some(adapter => adapter.name === 'my97-date')) return;
  const H = R.helpers;
  const flags = { writeStarted: false, liveSupportClaimed: false };
  const formats = Object.freeze({
    'yyyy-MM-dd': { precision: 'date', canonical: 'YYYY-MM-DD' },
    'yyyy-MM-dd HH:mm': { precision: 'datetime', canonical: 'YYYY-MM-DDTHH:mm' },
    'yyyy-MM-dd HH:mm:ss': { precision: 'datetime', canonical: 'YYYY-MM-DDTHH:mm:ss' },
  });
  const my97Hint = el => !!el?.matches?.('input') && (el.classList.contains('Wdate')
    || ['onfocus', 'onclick'].some(key => /\bWdatePicker\b/u.test(el.getAttribute(key) || '')));
  const surfaceHint = el => !!el?.matches?.('[data-date-picker],[data-datepicker],[data-date-format],.ant-picker,.ant-picker-input')
    || [...(el?.classList || [])].some(token => /(?:^|-)(?:date-?picker|datetime-?picker|month-?picker|calendar)(?:$|-)/iu.test(token));
  function hint(el) {
    if (my97Hint(el)) return true;
    if (surfaceHint(el)) return true;
    if (!el?.matches?.('input,textarea')) return false;
    if (el.matches('input[type="date"],input[type="month"]')) return true;
    for (let node = el; node && !node.matches('body,html,form'); node = node.parentElement) {
      if (surfaceHint(node)) return true;
    }
    return false;
  }
  function inspect(el, probe = globalThis.ResumeControlModel.inspect(el)) {
    const result = { status: 'manual', kind: 'unknown', precision: null, format: null,
      canonicalFormat: null, reason: 'date_contract_unconfirmed', readbackSource: null, ...flags };
    if (!my97Hint(el)) return result;
    result.kind = 'my97';
    if (probe.framework !== 'native' || probe.lib && probe.lib !== 'native') return { ...result, reason: 'date_model_ownership_unconfirmed' };
    for (let node = el; node && !node.matches('body,html,form'); node = node.parentElement) {
      if ([...node.classList].some(token => /^(?:el|ant|ivu|ud|phoenix|atsx|am)-/u.test(token)))
        return { ...result, reason: 'date_model_ownership_unconfirmed' };
    }
    if (el.type !== 'text' || el.getAttribute('type') && el.getAttribute('type').toLowerCase() !== 'text') return result;
    if (typeof globalThis.WdatePicker !== 'function') return { ...result, reason: 'my97_library_unconfirmed' };
    const handlers = ['onfocus', 'onclick'].map(key => el.getAttribute(key)).filter(value => value?.trim());
    // Accept only the reviewed literal subset. Extra properties, callbacks,
    // target IDs, expressions and dynamic constraints remain manual.
    const match = handlers.length === 1 && handlers[0].match(/^\s*(?:return\s+)?WdatePicker\(\s*\{\s*dateFmt\s*:\s*(['"])([^'"\r\n]+)\1\s*\}\s*\)\s*;?\s*$/u);
    if (!match) return { ...result, reason: 'my97_config_unconfirmed' };
    const format = match[2], contract = formats[format];
    if (!contract) return { ...result, format, reason: 'date_format_unconfirmed' };
    if (el.hasAttribute('min') || el.hasAttribute('max') || el.hasAttribute('step')) return { ...result, reason: 'date_constraint_unconfirmed' };
    const disabled = el.disabled || el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true';
    const readonly = el.readOnly || el.getAttribute('aria-readonly') === 'true';
    return { ...result, status: disabled || readonly ? 'manual' : 'observed',
      reason: disabled ? 'disabled' : readonly ? 'readonly' : 'date_contract_confirmed',
      precision: contract.precision, format, canonicalFormat: contract.canonical,
      detectionEvidence: 'my97_function_and_literal_dateFmt', readbackSource: 'html_input_value', disabled, readonly };
  }
  function valid(value, observation) {
    if (typeof value !== 'string') return false;
    const seconds = observation.canonicalFormat === 'YYYY-MM-DDTHH:mm:ss';
    if (observation.precision === 'date') return H.validDate(value, 'date');
    const match = value.match(seconds ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})$/u
      : /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/u);
    return !!match && H.validDate(match[1], 'date') && Number(match[2]) < 24
      && Number(match[3]) < 60 && (!seconds || Number(match[4]) < 60);
  }
  function modelFor(el, probe) {
    const observation = inspect(el, probe);
    const value = el.value?.replace(' ', 'T') || '';
    const exactDisplay = observation.precision === 'date' || el.value === value.replace('T', ' ');
    return { ...probe, ...observation, lib: 'my97', version: 'literal-dateFmt-v1', controlRoot: el,
      value: observation.precision === 'date' ? el.value : value, domValue: el.value,
      available: observation.status === 'observed' && exactDisplay && (el.value === '' || valid(value, observation)) };
  }
  function plan(fact, model) {
    const manual = reason => ({ status: 'manual', reason, ...flags });
    if (model.status !== 'observed') return manual(model.reason);
    if (!model.available) return manual('date_readback_unconfirmed');
    const value = fact && typeof fact === 'object' ? fact.value : fact;
    if (!valid(value, model)) return manual('invalid_date_precision');
    const domValue = model.precision === 'date' ? value : value.replace('T', ' ');
    const planned = H.makePlan({ value }, { ...model, domValue: model.value }, { type: 'text' });
    return { ...planned, domValue, precision: model.precision, format: model.format,
      canonicalFormat: model.canonicalFormat, readbackSource: model.readbackSource, liveSupportClaimed: false };
  }
  for (const type of ['date', 'datetime']) R.register({
    name: `my97-${type}`, lib: 'my97', type, priority: 800,
    matches: (el, probe) => my97Hint(el) && inspect(el, probe).precision === type,
    libVersionProbe: () => ({ lib: 'my97', version: 'literal-dateFmt-v1' }), readModel: modelFor, plan,
    async performWrite(el, instruction, ctx) {
      // My97's input is the authoritative public value. Editable, confirmed
      // inputs use existing checked HTML events; readonly calendars stay manual.
      const current = plan({ value: instruction.value }, modelFor(el));
      if (!['planned', 'success'].includes(current.status)) return current;
      if (current.status === 'success') return { strategy: 'none', attempts: 0 };
      await H.nativeSet(el, instruction.domValue, ctx);
      return { strategy: 'native', attempts: 1 };
    },
  });
  // Below confirmed date adapters, above generic text. Unknown versions,
  // browser type downgrades and ambiguous picker hints are consumed manually.
  R.register({ name: 'date-unknown', lib: 'date', type: 'date', priority: 19,
    matches: el => hint(el),
    libVersionProbe: () => ({ lib: 'date', version: 'unknown' }),
    readModel: (el, probe) => ({ ...probe, ...inspect(el, probe), available: false, controlRoot: el }),
    plan: (_fact, model) => ({ status: 'manual', reason: model.reason, ...flags }),
  });
  globalThis.ResumeDateControls = Object.freeze({ version: 1, inspect, liveSupportClaimed: false });
})();
