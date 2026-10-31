/* First-party synthetic upload phenomena. No real files, captured pages,
 * recruiting requests, or implementation from an ATS vendor are included. */
(() => {
  'use strict';
  const name = window.__ZOO_CASE__, app = document.querySelector('#app');
  const effects = { blacklistClicks: 0, clicks: 0, fileAssignments: 0, filePickerCalls: 0,
    inputEvents: 0, changeEvents: 0, dragEvents: 0, submits: 0, resets: 0 };
  const cases = {
    'upload-native': '<label for="target">Attachment</label><input id="target" type="file" accept=".pdf,image/*" multiple>',
    'upload-hidden-zone': '<div id="target" class="dropzone" role="group" aria-label="Attachment"><input id="file" type="file" hidden><p>Drop a file here</p><input id="display" value="KEEP_DISPLAY" readonly><button type="button">Choose file</button></div>',
    'upload-preview': '<section id="target" class="attachment-control" role="group"><input id="file" type="file" hidden><div data-upload-preview><span data-file-name>synthetic-report.pdf</span></div><a href="/never-open-preview" aria-label="Preview">View</a><button type="button">Clear</button><button type="button">Remove</button></section>',
    'upload-defer': '<fieldset id="target"><legend>Attachment</legend><input id="file" type="file"><button type="button">Skip</button><button type="button">Later</button><button>稍后上传</button><a href="/never-navigate">Skip</a></fieldset>',
    'upload-unconfirmed': '<div id="target" class="dropzone"><p>Drop a file here</p><button type="button">Choose file</button></div><div id="shared" class="upload-control"><input type="file"><input type="file"></div><button type="button" id="words-only">Upload</button>',
    'upload-disabled-busy': '<fieldset id="target" disabled><legend>Attachment</legend><input id="file" type="file"><button type="button">Clear</button></fieldset><div id="busy" class="upload-control" aria-busy="true"><input type="file"><button type="button">Later</button></div>',
    'upload-route': '<form><div id="target" class="upload-control" role="group"><input id="file" type="file" hidden><label for="display">Name</label><input id="display" value="KEEP_DISPLAY"><button type="button">Clear</button></div></form>',
  };
  if (!Object.hasOwn(cases, name)) throw Error(`unknown_upload_case:${name}`);
  app.innerHTML = cases[name];
  // Fail immediately if an observer tries to open a picker or assign files.
  // The fixture never creates a File or DataTransfer and never populates files.
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
  Object.defineProperty(HTMLInputElement.prototype, 'files', { ...descriptor,
    set() { effects.fileAssignments++; throw Error('offline_file_assignment_forbidden'); } });
  const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  Object.defineProperty(HTMLInputElement.prototype, 'value', { ...valueDescriptor,
    set(value) {
      if (this.type === 'file') { effects.fileAssignments++; throw Error('offline_file_value_assignment_forbidden'); }
      valueDescriptor.set.call(this, value);
    } });
  if (HTMLInputElement.prototype.showPicker) HTMLInputElement.prototype.showPicker = function () {
    effects.filePickerCalls++; throw Error('offline_file_picker_forbidden');
  };
  document.addEventListener('click', event => {
    effects.clicks++;
    const action = event.target.closest('button,a,input[type="submit"]');
    if (action && /^(保存|提交|下一步|投递|删除)$/u.test(action.textContent.trim())) effects.blacklistClicks++;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  for (const [eventName, counter] of [['input', 'inputEvents'], ['change', 'changeEvents'],
    ['dragenter', 'dragEvents'], ['dragover', 'dragEvents'], ['dragleave', 'dragEvents'], ['drop', 'dragEvents'],
    ['submit', 'submits'], ['reset', 'resets']]) {
    document.addEventListener(eventName, event => { effects[counter]++; event.preventDefault(); }, true);
  }
  const model = () => ({ neighbor: document.querySelector('#neighbor').value,
    disabledValue: document.querySelector('#disabled-neighbor').value,
    display: document.querySelector('#display')?.value ?? null,
    files: [...document.querySelectorAll('input[type="file"]')].map(input => ({ count: input.files.length, value: input.value })) });
  window.__zoo = { ready: true, case: name, liveSupportClaimed: false, readModel: model,
    snapshot: () => ({ html: app.innerHTML, model: model(), effects: { ...effects } }) };
})();
