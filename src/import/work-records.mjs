// Conservative structured import. Every candidate is one complete, explicitly
// labelled work record; it never gathers company/role/dates across records.
export const WORK_KEYS = Object.freeze(['type', 'organization', 'position', 'startDate', 'endDate', 'description']);
const TYPES = new Set(['internship', 'fulltime', 'other']);
const norm = value => String(value ?? '').normalize('NFKC').replace(/[\s\u00a0]+/gu, ' ').trim();
const descriptionNorm = value => String(value ?? '').normalize('NFKC').replace(/\r\n?/gu, '\n').split('\n').map(norm).filter(Boolean).join('\n');
const month = value => {
  const match = /^((?:19|20)\d{2})[-./年](\d{1,2})月?$/u.exec(norm(value));
  return match && +match[2] >= 1 && +match[2] <= 12 ? `${match[1]}-${match[2].padStart(2, '0')}` : '';
};
const heading = /^(工作经历|工作经验|工作与实习|工作与实习经历|实习经历|实习经验|正式工作经历)(?:\s*(?:第?\s*[一二三四五六七八九十\d]+\s*(?:段|条)?))?\s*[:：]?$/u;
const nextSection = /^(?:教育经历|教育背景|学习经历|项目经历|项目经验|研究经历|求职意向|职业技能与特长|职业技能|技能|语言能力|证书|获奖经历|获奖情况|荣誉奖项|自我评价|家庭成员|Education|Projects|Skills)(?=\s|[:：()（）\d一二三四五六七八九十]|$)/iu;
const fieldNames = '公司名称|单位名称|工作单位|实习单位|公司|单位|岗位名称|实习岗位|工作岗位|岗位|职位|类型|经历类型|工作类型|开始年月|开始时间|入职年月|入职时间|结束年月|结束时间|离职年月|离职时间|起止年月|起止时间|任职时间|实习时间|职责描述|主要工作|工作内容|实习内容|工作描述|职责';
const field = new RegExp(`^(${fieldNames})\\s*[:：]\\s*(.+)$`, 'u');
const splitLabels = new RegExp(`(?:\\s+|\\s*[;；|｜]\\s*)(?=(?:${fieldNames})\\s*[:：])`, 'u');
const rangePattern = /^((?:19|20)\d{2}[-./年]\d{1,2}月?)\s*(?:至|到|~|～|—|–|-)\s*((?:19|20)\d{2}[-./年]\d{1,2}月?)$/u;
const kindForHeading = label => /实习经历|实习经验/u.test(label) ? 'internship' : label === '正式工作经历' ? 'fulltime' : '';
const kindForValue = value => ({ 实习: 'internship', 实习经历: 'internship', 正式工作: 'fulltime', 全职: 'fulltime', 全职工作: 'fulltime', 其他: 'other' })[norm(value)] || '';
const keyFor = label => /^(?:公司名称|单位名称|工作单位|实习单位|公司|单位)$/u.test(label) ? 'organization'
  : /^(?:岗位名称|实习岗位|工作岗位|岗位|职位)$/u.test(label) ? 'position'
  : /类型/u.test(label) ? 'type' : /^(?:开始|入职)/u.test(label) ? 'startDate'
  : /^(?:结束|离职)/u.test(label) ? 'endDate' : /^(?:起止|任职时间|实习时间)/u.test(label) ? 'range' : 'description';

export function detectWorkRecords(text) {
  const candidates = [], warnings = [], blocks = [];
  let inside = false, headingType = '', current = null, descriptionOpen = false;
  const close = () => { if (current) blocks.push(current); current = null; descriptionOpen = false; };
  const append = (key, value) => { (current.fields[key] ||= []).push(value); };
  for (const raw of String(text || '').replace(/\r\n?/gu, '\n').split('\n')) {
    const line = norm(raw); if (!line) continue;
    const section = heading.exec(line);
    if (section) { close(); inside = true; headingType = kindForHeading(section[1]); continue; }
    if (nextSection.test(line)) { close(); inside = false; headingType = ''; continue; }
    if (!inside) continue;
    if (/^(?:第\s*[一二三四五六七八九十\d]+\s*段|[一二三四五六七八九十\d]+[.、])$/u.test(line)) { close(); continue; }
    const fragments = line.split(splitLabels);
    for (const fragment of fragments) {
      const match = field.exec(fragment);
      if (!match) {
        // Another labelled attribute stops a multiline responsibility value.
        // Do not copy department/salary/next unknown labels into duties.
        if (/^[^:：]{1,30}[:：]/u.test(fragment)) { descriptionOpen = false; continue; }
        if (current && descriptionOpen) {
          const descriptions = current.fields.description;
          descriptions[descriptions.length - 1] += '\n' + fragment;
          current.evidence.push(fragment);
        }
        continue;
      }
      const key = keyFor(match[1]), value = norm(match[2]);
      if (key === 'organization') {
        close(); current = { fields: { organization: [value] }, evidence: [fragment], invalid: false };
        if (headingType) append('type', headingType);
        continue;
      }
      if (!current) { warnings.push('工作/实习字段出现在明确公司之前，未与后续公司拼接；请手动核对。'); continue; }
      current.evidence.push(fragment); descriptionOpen = false;
      if (key === 'range') {
        const range = rangePattern.exec(value);
        if (!range || !month(range[1]) || !month(range[2])) current.invalid = true;
        else { append('startDate', month(range[1])); append('endDate', month(range[2])); }
        continue;
      }
      const parsed = key === 'type' ? kindForValue(value) : key === 'startDate' || key === 'endDate' ? month(value) : value;
      if (!parsed || (key !== 'description' && /[:：]/u.test(parsed))) { current.invalid = true; continue; }
      append(key, parsed); descriptionOpen = key === 'description';
    }
  }
  close(); const signatures = new Set();
  for (const [index, block] of blocks.entries()) {
    const number = index + 1;
    const values = Object.fromEntries(Object.entries(block.fields).map(([key, list]) => [key, [...new Set(list)]]));
    if (block.invalid || WORK_KEYS.some(key => values[key]?.length !== 1)) {
      warnings.push(`工作/实习第${number}段${values.organization?.[0] ? `（${values.organization[0]}）` : ''}缺少明确类型、公司、岗位、起止年月或职责，或存在冲突，未组成候选。`); continue;
    }
    const row = Object.fromEntries(WORK_KEYS.map(key => [key, values[key][0]]));
    row.description = descriptionNorm(row.description);
    if (!validWorkRecord(row)) { warnings.push(`工作/实习第${number}段日期先后或字段长度无效，未组成候选。`); continue; }
    const signature = JSON.stringify(row);
    if (signatures.has(signature)) { warnings.push(`工作/实习第${number}段与前段完全相同，未重复生成候选。`); continue; }
    signatures.add(signature);
    const kind = row.type === 'internship' ? '实习' : row.type === 'fulltime' ? '正式工作' : '其他经历';
    candidates.push({ path: 'experienceRecord', label: `${kind}第${number}段 · ${row.organization} · ${row.position}`,
      value: `${row.organization} · ${row.position} · ${row.startDate}—${row.endDate} · ${kind}`,
      experienceRecord: row, evidence: block.evidence.join('；').slice(0, 800),
      basis: '同一明确工作/实习段内的公司、岗位、类型、起止年月及职责标签' });
  }
  return { candidates, warnings };
}

function validWorkRecord(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).length !== WORK_KEYS.length
    || Object.keys(row).some(key => !WORK_KEYS.includes(key)) || WORK_KEYS.some(key => typeof row[key] !== 'string' || !row[key].trim())) return false;
  if (!TYPES.has(row.type) || row.organization.length > 200 || row.position.length > 200 || row.description.length > 4000
    || month(row.startDate) !== row.startDate || month(row.endDate) !== row.endDate || row.startDate > row.endDate) return false;
  return WORK_KEYS.every(key => !(key === 'description' ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u : /[\u0000-\u001f\u007f]/u).test(row[key]));
}
const normalizedRow = row => Object.fromEntries(WORK_KEYS.map(key => [key, key === 'description' ? descriptionNorm(row?.[key]) : norm(row?.[key])]));
const compatibleMonth = (old, incoming) => !old || !month(old.slice(0, 7)) || month(old.slice(0, 7)) === incoming;

// Adds a record after existing rows. Never updates by array index or fills a
// partial existing company's row with facts selected for another record.
export function mergeWorkRecord(profile, candidate, added, conflicts) {
  const conflict = reason => conflicts.push({ path: 'experienceRecord', label: candidate?.label || '工作/实习经历',
    current: '已有经历保持原样', incoming: typeof candidate?.value === 'string' ? candidate.value.slice(0, 200) : '', reason });
  if (!validWorkRecord(candidate?.experienceRecord)) { conflict('experience_candidate_invalid'); return; }
  const incoming = normalizedRow(candidate.experienceRecord);
  if (profile.experience.some(row => WORK_KEYS.every(key => normalizedRow(row)[key] === incoming[key]))) return;
  const possible = profile.experience.some(row => {
    const old = normalizedRow(row);
    if (!old.organization || old.organization !== incoming.organization || !compatibleMonth(old.startDate, incoming.startDate) || !compatibleMonth(old.endDate, incoming.endDate)) return false;
    return !old.position || old.position === incoming.position || (old.startDate === incoming.startDate && old.endDate === incoming.endDate);
  });
  if (possible) { conflict('experience_existing_record_ambiguous'); return; }
  if (profile.experience.length >= 30) { conflict('experience_record_limit'); return; }
  const index = profile.experience.length; profile.experience.push(incoming);
  for (const key of WORK_KEYS) {
    const path = `experience.${index}.${key}`;
    profile.confirmedFields = profile.confirmedFields.filter(field => field !== path);
    profile.sources[path] = 'resume'; added.push(path);
  }
}
