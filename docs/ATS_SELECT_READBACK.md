# Generic phone/select and date-part readback

Base: `b90e6e7402a921c02ea36fa97d77978bcda74208`, targeting
`cursor/expand-night-ats-f861`. `liveSupportClaimed=false`; Never-Save.

The existing native select adapter consumes exactly one enabled option by its
explicit value or label. A confirmed `+86` option value can display `中国 (+86)`;
a phone option can likewise display a formatted number. Ordinary inspect/fill
now compares the selected option identity with the uniquely resolved target,
instead of comparing the display text directly with the source fact. Existing
matching selections need no events, and different selections remain protected.
Missing, ambiguous, disabled or unconfirmed choices remain manual.

There is no country-code fact synthesis: no prefix is inferred from a country
name, phone number or default choice. Country-code answers use the existing
explicit, scoped, confirmed custom-fact path; phone facts retain their existing
confirmation and validation. Unknown questions and framework controls remain
manual. There are no host, field-ID or ATS-selector additions.

Date-part select prompts `年/月/日`, `year/month/day` and `YYYY/MM/DD` read as
empty only when their value is empty, `-1`, `0` or the matching prompt token,
and the other enabled options prove the corresponding numeric date-part
family. Years are four digits in 1900–2100; months are 1–12; days are 1–31.
Option labels must agree numerically with values, optionally with the matching
Chinese suffix. Zero padding is accepted. A mixed or unknown option list,
ordinary frequency choices such as `Month`, and real selections are preserved.
Recognized prompts cannot be write targets. Ordinary empty `请选择` keeps its
existing L1 display contract. Birthday parts without a confirmed binding stay
manual; the engine does not split a birthday fact into three answers.

MAIN registry revision 7 and ordinary engine revision 14 replace stale injected
contracts. The existing write opt-in, profile lock, per-effect guard, ownership
checks and two settled readbacks remain in force. HTML select value and label
are public readbacks, not independent application-model or persistence evidence.

Local reproduction (Node 24, PowerShell, repository root):

```powershell
npm ci --ignore-scripts
$l1Tests = @(Get-ChildItem tests -File -Filter 'l1-*.test.mjs' | Sort-Object Name | ForEach-Object FullName)
$l1Tests += (Join-Path (Get-Location) 'tests\product-paths-whitelist.test.mjs')
node --test @l1Tests
node --test tests/engine-manual-controls.test.mjs tests/l3-ats-profiles.test.mjs tests/cms-basic-info-gaps.test.mjs tests/cms-row-d-preexisting-trial.test.mjs
npx playwright install chromium
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo
```

The zoo executes packaged bytes in isolated disposable browsers, fulfills fixture
requests locally and blocks non-GET traffic. It never attaches to a real form.
Country/phone selects, date-part prompts, unchanged neighbors, manual outcomes
and zero save/submit effects are checked through the ordinary route. No live
probe, real save/submit, or claim of live support is part of this change.

Verified locally: 314 Node tests passed (138 L1/whitelist plus 176 engine/profile
regressions), all 67 zoo tests passed, and build-internal packaged 148 files.
The package ZIP SHA256 was
`ea0f28aa662d107176b119afb08de436b2cfbb6b22ca0a947358f5464ab37e7e`.
