/* First-party L2 metadata memory. This module never learns from a fill result. */
(function (root) {
  "use strict";
  const STORAGE_KEY = "resumeAtsFieldMappingsV1";
  const MAX_ENTRIES = 200;
  const text = value => typeof value === "string" ? value.normalize("NFKC").replace(/\s+/gu, " ").trim() : "";
  const texts = (values, limit) => {
    if (!Array.isArray(values) || values.length > limit || values.some(value => typeof value !== "string" || value.length > 200 || /[\u0000-\u001f]/u.test(value))) throw Error("memory_metadata_invalid");
    return values.map(text);
  };
  function fieldMetadata(input) {
    const labels = texts(input?.labels, 8), options = texts(input?.options || [], 100);
    const section = text(input?.section || "");
    const index = input?.index ?? null;
    const kind = text(input?.kind || "");
    if (!labels.length || labels.some(label => !label) || section.length > 160 || kind.length > 40
      || (index !== null && (!Number.isInteger(index) || index < 0 || index >= 30))) throw Error("memory_metadata_invalid");
    return { labels, options, section, index, kind };
  }
  function fieldSignature(input) {
    const metadata = fieldMetadata(input);
    return JSON.stringify([metadata.section, metadata.index, metadata.kind, metadata.labels, metadata.options]);
  }
  function mappingFits(metadata, path) {
    if (!root.ResumeMatcher?.isProfileKey(path)) return false;
    const kind = root.ResumeMatcher.sectionKind(metadata.section);
    if (kind === "certificate") return false;
    const collection = kind === "education" ? "education" : kind === "project" ? "projects"
      : ["work", "internship"].includes(kind) ? "experience" : null;
    if (collection) return Number.isInteger(metadata.index) && path.startsWith(`${collection}.${metadata.index}.`);
    if (path.includes(".")) return false;
    return !["basic", "intent"].includes(kind) || Object.hasOwn(root.ResumeMatcher.sectionDefinitions[kind], path);
  }
  async function pageIdentity(value) {
    let url;
    try { url = new URL(value); } catch { throw Error("memory_page_invalid"); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw Error("memory_page_invalid");
    // Hash only the path; queries/fragments and the full URL are never stored.
    const bytes = new TextEncoder().encode(url.pathname);
    const digest = await root.crypto.subtle.digest("SHA-256", bytes);
    return { domain: url.hostname.toLowerCase(), pageFp: [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("") };
  }
  function validEntry(row) {
    try {
      return row?.confirmedBy === "user" && mappingFits(row, row.profileKey)
        && typeof row.domain === "string" && /^[a-z0-9.-]+$/u.test(row.domain)
        && /^[a-f0-9]{64}$/u.test(row.pageFp) && row.fieldSig === fieldSignature(row)
        && Object.keys(row).sort().join("|") === "confirmedBy|domain|fieldSig|index|kind|labels|options|pageFp|profileKey|section";
    } catch { return false; }
  }
  async function readAll(storage) {
    const record = (await storage.get(STORAGE_KEY))?.[STORAGE_KEY];
    return record?.version === 1 && Array.isArray(record.entries)
      ? record.entries.filter(validEntry).slice(-MAX_ENTRIES) : [];
  }
  async function load(storage, url) {
    const page = await pageIdentity(url);
    const entries = (await readAll(storage)).filter(row => row.domain === page.domain && row.pageFp === page.pageFp);
    return { ...page, entries };
  }
  function lookup(snapshot, input) {
    let fieldSig;
    try { fieldSig = fieldSignature(input); } catch { return null; }
    const hits = (snapshot?.entries || []).filter(row => validEntry(row) && row.domain === snapshot.domain && row.pageFp === snapshot.pageFp && row.fieldSig === fieldSig);
    return hits.length === 1 ? { status: "mapped", profileKey: hits[0].profileKey, reason: "confirmed_domain_mapping" } : null;
  }
  async function commitConfirmation(storage, url, input, profileKey, confirmation) {
    if (confirmation?.confirmed !== true || confirmation?.source !== "user") throw Error("memory_confirmation_required");
    const page = await pageIdentity(url), metadata = fieldMetadata(input), fieldSig = fieldSignature(metadata);
    if (!mappingFits(metadata, profileKey)) throw Error("memory_profile_key_invalid");
    const row = { ...page, ...metadata, fieldSig, profileKey, confirmedBy: "user" };
    const entries = (await readAll(storage)).filter(old => old.domain !== page.domain || old.pageFp !== page.pageFp || old.fieldSig !== fieldSig);
    entries.push(row);
    await storage.set({ [STORAGE_KEY]: { version: 1, entries: entries.slice(-MAX_ENTRIES) } });
    return { ...page, fieldSig, profileKey };
  }
  // Multiple explicit confirmations in one popup must not overwrite each
  // other's read/modify/write operation.
  let pendingWrite = Promise.resolve();
  function confirm(...args) {
    const result = pendingWrite.then(() => commitConfirmation(...args));
    pendingWrite = result.catch(() => {});
    return result;
  }
  const api = Object.freeze({ STORAGE_KEY, fieldMetadata, fieldSignature, mappingFits, pageIdentity, load, lookup, confirm });
  root.ResumeDomainMemory = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
