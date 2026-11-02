/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * UXP language metadata adapter; fallback "auto" is handled by Google.
 */
var TWPUXPLanguage = (function () {
  "use strict";
  function normalize(value) {
    if (!value || typeof value !== "string") return null;
    var code = value.trim().split(/[;,\s]+/)[0].replace(/_/g, "-").toLowerCase();
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(code)) return null;
    if (code === "und" || code === "zxx" || code === "mul") return null;
    var base = code.split("-")[0];
    if (base === "zh") return code.indexOf("tw") !== -1 || code.indexOf("hk") !== -1 ? "zh-TW" : "zh-CN";
    // Google generally expects language bases rather than locale variants.
    if (base === "pt") return code.indexOf("br") !== -1 ? "pt" : "pt";
    return base;
  }
  function detect(doc) {
    if (!doc) return "auto";
    var candidates = [];
    try {
      if (doc.documentElement) {
        candidates.push(doc.documentElement.getAttribute("lang"));
        candidates.push(doc.documentElement.getAttribute("xml:lang"));
      }
    } catch (e) {}
    try {
      var meta = doc.querySelectorAll('meta[http-equiv],meta[name]');
      for (var i = 0; i < meta.length; i++) {
        var tag = meta[i], key = (tag.getAttribute("http-equiv") || tag.getAttribute("name") || "").toLowerCase();
        if (key === "content-language" || key === "language")
          candidates.push(tag.getAttribute("content"));
      }
    } catch (e) {}
    for (var j = 0; j < candidates.length; j++) {
      var code = normalize(candidates[j]);
      if (code) return code;
    }
    return "auto";
  }
  return {detect: detect, normalize: normalize};
})();
