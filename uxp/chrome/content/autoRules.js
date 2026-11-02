/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Pure site/language auto-translation policy. Does not access page content.
 */
var TWPUXPAutoRules = (function () {
  "use strict";
  function normalizeHost(input) {
    var host = String(input || "").trim().toLowerCase();
    host = host.replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/\.$/, "");
    if (host.indexOf(":") !== -1 || host.indexOf("@") !== -1 || !host) return "";
    if (host.indexOf("*.") === 0) host = host.slice(2);
    var labels = host.split(".");
    if (!labels.every(function (label) {
      return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
    })) return "";
    return host;
  }
  function parseHosts(value, strict) {
    var seen = {}, out = [];
    String(value || "").split(/[\s,;]+/).forEach(function (entry) {
      if (!entry) return;
      var host = normalizeHost(entry);
      if (!host) {
        if (strict) throw new Error("Invalid site rule: " + entry);
        return;
      }
      if (!seen[host]) { seen[host] = true; out.push(host); }
    });
    return out;
  }
  function parseLanguages(value, service, strict) {
    var seen = {}, out = [];
    String(value || "").split(/[\s,;]+/).forEach(function (part) {
      if (!part) return;
      var code = part.trim();
      if (!TWPUXPLanguageCatalog.has(code, service || "google")) {
        if (strict) throw new Error("Unsupported language for " + service + ": " + code);
        return;
      }
      if (!seen[code]) {seen[code] = true; out.push(code);}
    });
    return out;
  }
  function matchesHost(host, patterns) {
    host = normalizeHost(host);
    if (!host) return false;
    return patterns.some(function (rule) {
      return host === rule || host.slice(-(rule.length + 1)) === "." + rule;
    });
  }
  function shouldTranslate(host, detected, target, allowed, excluded, languages, neverLanguages) {
    var blocked = parseHosts(excluded, false);
    if (matchesHost(host, blocked)) return false;
    // Explicit language exclusions override both site and language allow rules.
    if (detected && neverLanguages && neverLanguages.indexOf(detected) !== -1) return false;
    if (detected && detected !== "auto" && detected === target) return false;
    if (matchesHost(host, parseHosts(allowed, false))) return true;
    // No speculative language guesses: metadata must identify the source.
    return detected !== "auto" && !!detected &&
      languages.indexOf(detected) !== -1;
  }
  return {normalizeHost: normalizeHost, parseHosts: parseHosts,
    parseLanguages: parseLanguages, matchesHost: matchesHost,
    shouldTranslate: shouldTranslate};
})();
