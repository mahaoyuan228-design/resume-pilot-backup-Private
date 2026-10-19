# CMB 证件类型 DOM harvest (2026-10-19)

Never Save. This records the select id. It is not a live fill. 招行 is not supported. Acceptance stays **85%**.

Source file: `dist/site-probes/cmb-harvest-idCardType-dom-20261019.json`. Page: `https://career.cmbchina.com/center/resume`. harvestedAt `2026-10-19T04:42:18.051Z`.

## 证件类型

- Label text: 证件类型. The label is required (`ant-form-item-required`) and `for` is `resume_basicInfo_idCardType`.
- Select id: `resume_basicInfo_idCardType`. List id: `resume_basicInfo_idCardType_list`.
- selectClass: `ant-select ant-select-in-form-item ant-select-status-success ant-select-single ant-select-allow-clear ant-select-show-arrow`. There is no `ant-select-show-search`.
- The node that carries the id in the live page is `input.ant-select-selection-search-input`, with `aria` / `controls` pointing at the list. The offline fixture follows the other CMB selects: that same id sits on `.ant-select`, and the list id sits on the listbox. Option rows stay a synthetic stand-in. The fixture does not add `ant-select-show-search`.
- Options remain the 15 IdCardType text+code rows from `cmb-dictmap-full-20261019.json`.

`--live` still refuses `live_id_card_type_select_fill_unclaimed`. Options and the DOM id are both harvested. A live click is not proven, which is the same gate as 婚姻状况 / 政治面貌 / 民族.

## 证件号

`#resume_basicInfo_idCard` is a text input (`ant-input`, placeholder 请输入) on the same page. This knife does not fill it. The synthetic fixture keeps the input empty.

Other input ids visible in the harvest JSON are not wired.
