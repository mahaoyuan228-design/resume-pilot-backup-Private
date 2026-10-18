// Candidate render/collect seam for each normal Education card, not a hidden
// developer staging screen. Profile/options handlers remain release-owned.
const escape=value=>String(value??'').replace(/&/gu,'&amp;').replace(/</gu,'&lt;').replace(/>/gu,'&gt;').replace(/"/gu,'&quot;').replace(/'/gu,'&#39;');
export function renderRecordSiteFacts(profile,profileIndex,entries=[]){const row=profile?.education?.[profileIndex];if(!row)return '';
  const values=Object.fromEntries(entries.filter(entry=>entry.profileIndex===profileIndex).map(entry=>[entry.field,entry.value])),id=`cms-education-site-${profileIndex}`;
  return `<details class="education-site-facts" data-profile-index="${profileIndex}"><summary>招商证券补充资料 · 第 ${profileIndex+1} 段教育</summary>
    <p>${escape(row.school)} · ${escape(row.degree)}。这里的答案只属于这一段教育经历。</p>
    <div class="form-grid"><label class="field"><span>学位（与学历分别填写）</span><input id="${id}-academicDegree" type="text" maxlength="160" value="${escape(values.academicDegree)}" placeholder="按网站选项填写，例如学士"><small>未取得学位或网站没有对应选项时，先留空。</small></label>
    <label class="field"><span>学校所在省份／地区</span><input id="${id}-province" type="text" maxlength="160" value="${escape(values.region?.province)}" placeholder="填写该招聘网站提供的地区名称"></label>
    <label class="field"><span>学校所在城市</span><input id="${id}-city" type="text" maxlength="160" value="${escape(values.region?.city)}" placeholder="填写该招聘网站提供的城市名称"></label>
    <label class="field"><span>入学完整日期</span><input id="${id}-startDate" type="date" value="${escape(values.startDate)}"><small>基础资料：${escape(row.startDate||'未填写')}。只知道年月时可留空，软件不会补出日期。</small></label>
    <label class="field"><span>毕业完整日期</span><input id="${id}-endDate" type="date" value="${escape(values.endDate)}"><small>基础资料：${escape(row.endDate||'未填写')}。完整日期须与基础资料的年月一致。</small></label></div>
    <label><input id="${id}-checked" type="checkbox">我已核对本段补充资料</label>
    <button type="button" data-cms-site-save="${profileIndex}">核对并保存本段</button><p id="${id}-message" role="status"></p>
    <p class="hint">JSON 备份将包含这些已核对的补充资料；导入其他人的资料后，原补充资料会失效。</p></details>`;
}
export function collectRecordSiteFacts(root,profileIndex){const id=`cms-education-site-${profileIndex}`,get=key=>root.querySelector(`#${id}-${key}`)?.value?.trim()||'';
  return {draft:{academicDegree:get('academicDegree'),region:{province:get('province'),city:get('city')},startDate:get('startDate'),endDate:get('endDate')},checked:root.querySelector(`#${id}-checked`)?.checked===true};}
// Integration sequence: capture profile+resumeProfileLifecycle through the shared
// ready-state manager; render only activeSiteFacts(...).entries; on Save
// compare current ownerBinding and sourceSnapshotHash again, then persist the
// pure confirmRecordSiteFacts(...).store. Import/delete must use CLEAR_PROFILE_KEYS
// through that manager and the v2 backup API. Never announce the backup sentence
// until it is wired. Do not create a second epoch key or bypass changing state.
