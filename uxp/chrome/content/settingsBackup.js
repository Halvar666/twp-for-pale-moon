/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Portable, validated preference backups. No browser UI or file I/O here.
 * The SQLite translation cache and toolbar placement are intentionally excluded.
 */
var TWPUXPSettingsBackup = (function () {
  "use strict";
  var PREFIX = "extensions.twpuxp.";
  var FORMAT = "twp-uxp-settings";
  var VERSION = 1;
  var MAX_BYTES = 262144;
  var hasOwn = Object.prototype.hasOwnProperty;
  var fields = {
    from: "string", to: "string", translationService: "string",
    favoriteTargetLanguages: "string", customDictionary: "string",
    autoTranslateSites: "string", neverTranslateSites: "string",
    autoTranslateLanguages: "string", neverTranslateLanguages: "string",
    shortcutToggle: "string", shortcutSelection: "string", shortcutRestore: "string",
    autoTranslateEnabled: "boolean", privacyEnhancedRequests: "boolean",
    persistentCacheEnabled: "boolean", translateDynamicContent: "boolean",
    translatePageAttributes: "boolean", translateIframes: "boolean",
    useTwpParagraphEngine: "boolean", showPageProgress: "boolean",
    showOriginalOnHover: "boolean", keyboardShortcutsEnabled: "boolean",
    concurrentRequests: "integer", batchSize: "integer", maxNodes: "integer",
    requestDelayMs: "integer", timeoutMs: "integer"
  };
  var limits = {
    concurrentRequests: [1, 6], batchSize: [1, 20], maxNodes: [0, 1000000],
    requestDelayMs: [0, 60000], timeoutMs: [3000, 180000]
  };
  var maxStrings = {
    autoTranslateSites: 25000, neverTranslateSites: 25000,
    autoTranslateLanguages: 10000, neverTranslateLanguages: 10000,
    from: 40, to: 40, translationService: 20, favoriteTargetLanguages: 128,
    customDictionary: 12000,
    shortcutToggle: 120, shortcutSelection: 120, shortcutRestore: 120,
    apiKey: 4096
  };
  function own(obj, prop) { return hasOwn.call(obj, prop); }
  function object(value) {
    return value !== null && typeof value === "object" &&
      Object.prototype.toString.call(value) === "[object Object]";
  }
  function get(prefs, name, type) {
    var key = PREFIX + name;
    if (name === "customDictionary") return TWPUXPCustomDictionary.decode(prefs.getCharPref(key));
    if (type === "boolean") return prefs.getBoolPref(key);
    if (type === "integer") return prefs.getIntPref(key);
    return prefs.getCharPref(key);
  }
  function put(prefs, name, type, value) {
    var key = PREFIX + name;
    if (name === "customDictionary") prefs.setCharPref(key, TWPUXPCustomDictionary.encode(value));
    else if (type === "boolean") prefs.setBoolPref(key, value);
    else if (type === "integer") prefs.setIntPref(key, value);
    else prefs.setCharPref(key, value);
  }
  function checkType(key, value, type) {
    if (type === "boolean" && typeof value !== "boolean")
      throw new Error("Expected a boolean for " + key + ".");
    if (type === "integer" && (typeof value !== "number" ||
        !isFinite(value) || Math.floor(value) !== value ||
        value < limits[key][0] || value > limits[key][1]))
      throw new Error("Invalid numeric value for " + key + ".");
    if (type === "string" && (typeof value !== "string" ||
        value.length > (maxStrings[key] || 4096) || value.indexOf("\0") !== -1))
      throw new Error("Invalid text value for " + key + ".");
  }
  function validate(settings, prefs, deps) {
    if (!object(settings) || !Object.keys(settings).length)
      throw new Error("The backup contains no settings.");
    var result = {};
    Object.keys(settings).forEach(function (key) {
      var type = key === "apiKey" ? "string" : (own(fields, key) ? fields[key] : null);
      if (!type) throw new Error("Unknown setting: " + key + ".");
      checkType(key, settings[key], type);
      result[key] = settings[key];
    });
    function effective(key) { return own(result, key) ? result[key] : get(prefs, key, fields[key]); }
    var service = effective("translationService");
    if (["google", "bing", "deepl"].indexOf(service) < 0)
      throw new Error("Unknown translation service.");
    if (own(result, "customDictionary")) {
      if (!deps.dictionary || typeof deps.dictionary.normalize !== "function")
        throw new Error("Dictionary validator unavailable.");
      result.customDictionary = deps.dictionary.normalize(result.customDictionary);
    }
    if (own(result, "favoriteTargetLanguages")) {
      if (!deps.favorites || typeof deps.favorites.normalize !== "function")
        throw new Error("Favorite-language validator unavailable.");
      result.favoriteTargetLanguages = deps.favorites.normalize(result.favoriteTargetLanguages);
    }
    var from = effective("from"), to = effective("to");
    if (!deps.menus.has(from, true, service) || !deps.menus.has(to, false, service))
      throw new Error("The source or target language is not supported by " + service + ".");
    ["autoTranslateSites", "neverTranslateSites"].forEach(function (key) {
      if (own(result, key)) result[key] = deps.rules.parseHosts(result[key], true).join("\n");
    });
    ["autoTranslateLanguages", "neverTranslateLanguages"].forEach(function (key) {
      if (own(result, key)) result[key] = deps.rules.parseLanguages(result[key], service, true).join(",");
    });
    var shortcuts = {};
    ["toggle", "selection", "restore"].forEach(function (action) {
      var key = "shortcut" + action.charAt(0).toUpperCase() + action.slice(1);
      shortcuts[action] = effective(key);
    });
    var validShortcuts = deps.shortcuts.validateSet(shortcuts);
    ["toggle", "selection", "restore"].forEach(function (action) {
      var key = "shortcut" + action.charAt(0).toUpperCase() + action.slice(1);
      if (own(result, key)) result[key] = validShortcuts[action];
    });
    return result;
  }
  function exportJSON(prefs, includeKey, now) {
    var settings = {};
    Object.keys(fields).forEach(function (key) { settings[key] = get(prefs, key, fields[key]); });
    if (includeKey) settings.apiKey = prefs.getCharPref(PREFIX + "apiKey");
    return JSON.stringify({format: FORMAT, formatVersion: VERSION,
      createdAt: (now || new Date()).toISOString(), settings: settings}, null, 2) + "\n";
  }
  function decode(text, prefs, deps) {
    if (typeof text !== "string" || !text.length || text.length > MAX_BYTES)
      throw new Error("Backup file is empty or too large (maximum 256 KiB).");
    var data;
    try { data = JSON.parse(text); }
    catch (e) { throw new Error("Not a valid JSON backup file."); }
    if (!object(data) || data.format !== FORMAT || data.formatVersion !== VERSION)
      throw new Error("Unsupported backup format or version.");
    return validate(data.settings, prefs, deps);
  }
  function restore(prefs, settings, restoreKey) {
    var keys = Object.keys(settings).filter(function (key) {
      return key !== "apiKey" || restoreKey === true;
    });
    if (!keys.length) throw new Error("No settings selected for import.");
    var before = {};
    keys.forEach(function (key) {
      var type = key === "apiKey" ? "string" : fields[key];
      before[key] = {
        type: type,
        hadUser: prefs.prefHasUserValue(PREFIX + key),
        value: get(prefs, key, type)
      };
    });
    var written = [];
    try {
      keys.forEach(function (key) {
        written.push(key);
        put(prefs, key, before[key].type, settings[key]);
      });
    } catch (error) {
      var rollbackFailed = false;
      written.reverse().forEach(function (key) {
        try {
          if (before[key].hadUser) put(prefs, key, before[key].type, before[key].value);
          else prefs.clearUserPref(PREFIX + key);
        } catch (ignored) { rollbackFailed = true; }
      });
      if (rollbackFailed) throw new Error("Import failed and some settings could not be rolled back: " + error.message);
      throw error;
    }
    return keys.length;
  }
  return {fields: fields, format: FORMAT, version: VERSION,
    maxBytes: MAX_BYTES, exportJSON: exportJSON, decode: decode,
    restore: restore, validate: validate};
})();
