/* b3a1: Real settings-backup module, isolated preference service and real validators. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "../..");
const sandbox = {console};
vm.createContext(sandbox);
function load(name) {
  vm.runInContext(fs.readFileSync(path.join(root, "uxp/chrome/content/", name), "utf8"), sandbox, {filename:name});
}
["languageCatalog.js", "languageMenus.js", "autoRules.js", "shortcutBindings.js", "favoriteLanguages.js", "customDictionary.js", "settingsBackup.js"].forEach(load);
const backup = sandbox.TWPUXPSettingsBackup;
const deps = {menus:sandbox.TWPUXPLanguageMenus, rules:sandbox.TWPUXPAutoRules, shortcuts:sandbox.TWPUXPShortcutBindings, favorites:sandbox.TWPUXPFavoriteLanguages, dictionary:sandbox.TWPUXPCustomDictionary};
const prefix = "extensions.twpuxp.";
const defaults = {};
fs.readFileSync(path.join(root, "uxp/defaults/preferences/defaults.js"), "utf8")
  .replace(/pref\("extensions\.twpuxp\.([\w]+)",\s*("(?:[^"\\]|\\.)*"|\d+|true|false)\);/g, (_, k, v) => {
    defaults[k] = JSON.parse(v); return "";
  });
function mockPrefs() {
  const values = Object.assign({}, defaults);
  const user = new Set();
  let failure = null;
  const pref = {
    getCharPref(k) { assert.strictEqual(typeof values[k.slice(prefix.length)], "string"); return values[k.slice(prefix.length)]; },
    getBoolPref(k) { assert.strictEqual(typeof values[k.slice(prefix.length)], "boolean"); return values[k.slice(prefix.length)]; },
    getIntPref(k) { assert.strictEqual(typeof values[k.slice(prefix.length)], "number"); return values[k.slice(prefix.length)]; },
    prefHasUserValue(k) { return user.has(k); },
    clearUserPref(k) { user.delete(k); values[k.slice(prefix.length)] = defaults[k.slice(prefix.length)]; },
    setCharPref(k,v) { assign(k,v); },
    setBoolPref(k,v) { assign(k,v); },
    setIntPref(k,v) { assign(k,v); },
    failOn(k) { failure = prefix+k; }, values, user
  };
  function assign(k,v) { values[k.slice(prefix.length)] = v; user.add(k); if (k === failure) { failure = null; throw new Error("Injected preference write error"); } }
  return pref;
}
function malformed(base, changed) { return JSON.stringify(Object.assign({},base,changed)); }
function rejectsUnchanged(prefs, string, match) {
  const original = JSON.stringify(prefs.values), marker=JSON.stringify(Array.from(prefs.user));
  assert.throws(()=> backup.decode(string, prefs, deps), match);
  assert.strictEqual(JSON.stringify(prefs.values), original);
  assert.strictEqual(JSON.stringify(Array.from(prefs.user)), marker);
}
const p = mockPrefs();
p.setCharPref(prefix+"apiKey", "tajný-klíč-ČEŠTINA");
p.setCharPref(prefix+"autoTranslateSites", "www.example.com\nsub.example.net");
p.setCharPref(prefix+"translationService", "bing");
p.setCharPref(prefix+"favoriteTargetLanguages", "cs,en,fr");
p.setCharPref(prefix+"customDictionary", sandbox.TWPUXPCustomDictionary.encode("Pale Moon =>\nToolbar => Panel nástrojů"));
p.setCharPref(prefix+"shortcutToggle", "control,alt|Q");
p.setBoolPref(prefix+"showPageProgress", true);
p.setBoolPref(prefix+"privacyEnhancedRequests", false);
const date = new Date("2026-11-09T12:34:56Z");
const normal = backup.exportJSON(p, false, date);
assert(!normal.includes("tajný-klíč"), "Secret leaked into default backup");
assert(!normal.includes("toolbarInserted"), "Toolbar state must not be portable");
assert(!normal.includes("translationCache"), "Cache text must not be portable");
let obj = JSON.parse(normal);
assert.strictEqual(obj.format, "twp-uxp-settings");
assert.strictEqual(obj.formatVersion, 1);
assert.strictEqual(obj.createdAt, "2026-11-09T12:34:56.000Z");
assert.strictEqual(obj.settings.shortcutToggle, "control,alt|Q");
assert.strictEqual(obj.settings.favoriteTargetLanguages, "cs,en,fr");
assert.strictEqual(obj.settings.customDictionary, "Pale Moon =>\nToolbar => Panel nástrojů");
assert(!Object.prototype.hasOwnProperty.call(obj.settings, "apiKey"));
assert(Object.keys(obj.settings).length === Object.keys(backup.fields).length);
assert(backup.exportJSON(p, true, date).includes("tajný-klíč"));
const restored = mockPrefs();
restored.setCharPref(prefix+"apiKey", "preserve-me");
restored.setBoolPref(prefix+"toolbarInserted", true);
const selected = backup.decode(normal, restored, deps);
const count = backup.restore(restored, selected, false);
assert.strictEqual(count, Object.keys(backup.fields).length);
assert.strictEqual(restored.values.translationService, "bing");
assert.strictEqual(restored.values.shortcutToggle, "control,alt|Q");
assert.strictEqual(restored.values.favoriteTargetLanguages, "cs,en,fr");
assert.strictEqual(sandbox.TWPUXPCustomDictionary.decode(restored.values.customDictionary), "Pale Moon =>\nToolbar => Panel nástrojů");
assert.strictEqual(restored.values.autoTranslateSites, "www.example.com\nsub.example.net");
assert.strictEqual(restored.values.apiKey, "preserve-me");
assert.strictEqual(restored.values.toolbarInserted, true);
assert.strictEqual(restored.values.privacyEnhancedRequests, false);
assert.strictEqual(restored.values.showPageProgress, true);
const withSecret = backup.decode(backup.exportJSON(p,true,date), restored,deps);
backup.restore(restored, withSecret, false);
assert.strictEqual(restored.values.apiKey, "preserve-me");
backup.restore(restored, withSecret, true);
assert.strictEqual(restored.values.apiKey, "tajný-klíč-ČEŠTINA");
// Partial imports preserve all unspecified settings.
let partial = {format:obj.format,formatVersion:1,settings:{batchSize:3}};
const beforeService=restored.values.translationService;
backup.restore(restored, backup.decode(JSON.stringify(partial), restored,deps), false);
assert.strictEqual(restored.values.batchSize, 3);
assert.strictEqual(restored.values.translationService, beforeService);
// Rejection of unsupported, malicious, or structurally invalid input.
rejectsUnchanged(restored, "not json", /JSON/);
rejectsUnchanged(restored, JSON.stringify({...obj,format:"unknown"}), /Unsupported/);
rejectsUnchanged(restored, JSON.stringify({...obj,formatVersion:2}), /Unsupported/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{}}), /no settings/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{__bad:2}}), /Unknown setting/);
rejectsUnchanged(restored, '{"format":"twp-uxp-settings","formatVersion":1,"settings":{"__proto__":{}}}', /Unknown setting/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{constructor:"evil"}}), /Unknown setting/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{batchSize:"8"}}), /numeric/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{batchSize:22}}), /numeric/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{autoTranslateEnabled:1}}), /boolean/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{translationService:"danger"}}), /service/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{to:"invalid-language"}}), /language/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{favoriteTargetLanguages:"cs,cs"}}), /Duplicate favorite/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{customDictionary:"invalid row"}}), /Dictionary line/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{favoriteTargetLanguages:"cs,en,fr,sk"}}), /up to three/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{favoriteTargetLanguages:"cs,unknown-code"}}), /Invalid favorite/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{favoriteTargetLanguages:"cs,"}}), /Invalid favorite/);
// Older b3a1/b3a2 JSON backups omit the new key; import must preserve current favorites.
const previousFav = restored.values.favoriteTargetLanguages;
backup.restore(restored, backup.decode(JSON.stringify({...obj,settings:{to:"en"}}),restored,deps),false);
assert.strictEqual(restored.values.favoriteTargetLanguages,previousFav);

rejectsUnchanged(restored, JSON.stringify({...obj,settings:{autoTranslateSites:"broken..com"}}), /site rule/);
rejectsUnchanged(restored, JSON.stringify({...obj,settings:{shortcutRestore:"control,alt|Q"}}), /Duplicate shortcut/);
rejectsUnchanged(restored, "x".repeat(backup.maxBytes + 1), /too large/);
// Rejected writes must roll back even the key whose setter throws after changing its value.
const pending = backup.decode(JSON.stringify({...obj,settings:{batchSize:4,maxNodes:24}}),restored,deps);
restored.user.delete(prefix+"maxNodes");
restored.values.maxNodes=defaults.maxNodes;
const preBatch=restored.values.batchSize, preMax=restored.values.maxNodes;
restored.failOn("maxNodes");
assert.throws(()=> backup.restore(restored,pending,false), /Injected preference write error/);
assert.strictEqual(restored.values.batchSize,preBatch);
assert.strictEqual(restored.values.maxNodes,preMax);
assert(!restored.user.has(prefix+"maxNodes"));
console.log("PASS b3a1 settings: JSON, secret opt-in, typed validation, site/language/shortcuts, rollback and exclusions");
