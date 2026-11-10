/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Three optional target language favorites; independent of current provider.
 * No DOM / preference mutation; also used to validate imported JSON backups.
 */
var TWPUXPFavoriteLanguages = (function () {
  "use strict";
  var providers = ["google", "bing", "deepl"];
  var MAX = 3;
  function supported(code) {
    return providers.some(function(provider) {
      return TWPUXPLanguageCatalog.has(code, provider);
    });
  }
  function validate(codes) {
    if (!Array.isArray(codes) || codes.length > MAX)
      throw new Error("Choose up to three favorite target languages.");
    var seen = {};
    codes.forEach(function(code) {
      if (typeof code !== "string" || !code || !supported(code))
        throw new Error("Invalid favorite target language: " + code);
      if (seen[code]) throw new Error("Duplicate favorite target language: " + code);
      seen[code] = true;
    });
    return codes.join(",");
  }
  function normalize(raw) {
    if (typeof raw !== "string") throw new Error("Favorites must be a string.");
    if (!raw) return "";
    // Strict canonical comma list; no trailing commas or silently dropped entries.
    return validate(raw.split(","));
  }
  function list(raw) {
    try { var value = normalize(raw); return value ? value.split(",") : []; }
    catch (ignored) { return []; } // A manually corrupted user pref must not break the popup.
  }
  function available(raw, provider) {
    return list(raw).filter(function(code) {
      return TWPUXPLanguageCatalog.has(code, provider);
    });
  }
  function catalog() {
    var seen = {}, entries = [];
    providers.forEach(function(provider) {
      TWPUXPLanguageCatalog.list(provider).forEach(function(entry) {
        if (seen[entry[0]]) return;
        seen[entry[0]] = true;
        entries.push([entry[0], entry[1]]);
      });
    });
    entries.sort(function(a,b) {return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;});
    return entries;
  }
  function label(code, provider) {
    var entries = TWPUXPLanguageCatalog.list(provider);
    for (var i=0; i<entries.length; i++)
      if (entries[i][0] === code) return entries[i][1];
    return code;
  }
  return {max:MAX, validate:validate, normalize:normalize,
    list:list, available:available, catalog:catalog, label:label};
})();
