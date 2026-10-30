# L3 thin ATS profiles

`src/core/matcher.js` exports the immutable `atsProfiles` registry and
`resolveAtsProfile(hostname)` / `resolveAtsField({ hostname, labels, section, index })`.
The ordinary content engine uses this entry point and reports `atsProfile` on
collected fields. No additional product file or injection order is required.

| Profile | Domain families |
| --- | --- |
| `beisen` | `zhiye.com` |
| `moka` | `mokahr.com` |
| `hotjob` | `hotjob.cn` |
| `feishu` | `jobs.feishu.cn`, `jobs.bytedance.com`, `jobs.f.mioffice.cn` |

Matching accepts an exact domain or its subdomains. A host selects a vocabulary
skeleton only; it does not identify a component version or prove live support.
In particular, the Beisen host family can also contain legacy CMS portals.

Each configuration supplies `sectionAliases`, initially the same frozen copy
of the shared L2 section vocabulary. This is the system-level mapping extension
point. Field meanings, schema checks and repeated-record indices remain in the
common L2 resolver. Unknown hosts retain generic L2 behavior. Unknown labels,
conflicting labels, unknown sections, missing repeated indices and schema gaps
remain manual; explicit user-confirmed domain memory retains its existing role.
No tenant-specific fields, selectors, writers or inferred aliases are added.

L1 adapters, default-off write routing, the 148 product paths and Never-Save
guards are unchanged. All profiles and resolution results declare
`liveSupportClaimed=false`. This is offline configuration coverage only.

Verification: `node --test tests/l3-ats-profiles.test.mjs` covers all four
families, shared mapping semantics, domain boundaries and inert manual results
through ordinary inspect/fill with the write flag both false and true.
`tests/zoo/write-route.spec.mjs` checks packaged bytes on a locally fulfilled
Moka fixture, preserving unknown fields and existing neighbors with zero control
events, forbidden clicks or non-GET requests.
