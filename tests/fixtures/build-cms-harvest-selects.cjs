// One-off reproducible fixture extraction; never contacts a site.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../cms-edu-controls-materials');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const section = read('edu-section-static.json');
const fictional = text => String(text)
  .replaceAll('悉尼大学', '虚构示例大学')
  .replaceAll('0/20000/414000/414037/-10337', 'fixture-school-code')
  .replaceAll('Economics Major, Financial Economics Minor', 'Fictional Major')
  .replaceAll('Explicit major description fact', 'Fictional major description fact')
  .replaceAll('2023-02-01', '2020-09-01').replaceAll('2024-11-01', '2024-06-01');
const fields = section.rowSummaries[0].fields.filter(field => field.wrapperId).map(field => ({
  wrapperId: field.wrapperId, question: field.labelClean,
  itemHTML: fictional(field.itemOuterHTML),
  truncated: field.itemOuterHTML.length === 2000
}));
const menus = {};
for (const [question, name] of [['学校', 'field-school-open.json'], ['学位', 'field-xuewei-open.json'],
  ['专业排名', 'field-major-rank-open.json'], ['城市', 'field-city-open.json']]) {
  const captured = read(name);
  menus[question] = { source: name, html: fictional(captured.dropdownHTML),
    optionSamples: captured.optionsSample.map(option => fictional(option.outerHTML)) };
}
const degree = read('field-degree-xueli-options-extract.json');
menus['学历'] = {source: 'field-degree-xueli-options-extract.json',
  html: `<div class="ant-select-dropdown ant-select-dropdown--single">${degree.linkedHTML}</div>`};
const result = {
  evidence: 'Captured DOM prefixes and menu option samples; fictional applicant values; offline only.',
  materialRoot: 'C:\\Users\\admin\\Desktop\\ResumeQuickFill-Dev\\_temp-scripts\\cms-edu-controls-materials\\',
  sources: ['CMS_EDU_DOM_HARVEST_2026-10-23-2030.md', 'edu-section-static.json', 'matched-fields-index.json',
    'field-school.json', 'field-school-open.json', 'field-degree-xueli.json', 'field-degree-xueli-options-extract.json',
    'field-xuewei.json', 'field-xuewei-open.json', 'field-city.json', 'field-city-open.json',
    'field-major-rank.json', 'field-major-rank-open.json'],
  limits: ['2000-character item captures end inside decorative markup or, for city, inside the second selected-value element.',
    'The harness parses captured prefixes; it does not reconstruct unharvested city second-menu options.',
    'Only the dropdown shell around the complete captured degree linkedHTML and the form/section/row test scaffold are synthetic.'],
  fields, menus
};
fs.writeFileSync(path.join(__dirname, 'cms-education-harvest-selects.json'), JSON.stringify(result, null, 2) + '\n');
