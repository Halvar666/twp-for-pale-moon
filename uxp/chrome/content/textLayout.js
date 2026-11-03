/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Keep user-authored line endings, blank lines and indentation outside the
 * translation service, which may otherwise collapse or reorder whitespace.
 * Used by selection translation and multiline <pre> blocks.
 */
var TWPUXPTextLayout = (function () {
  "use strict";
  function plan(original, maxChars) {
    maxChars = Math.max(20, maxChars || 780);
    var fragments = [], template = [];
    function literal(value) { if (value) template.push(value); }
    function translate(value) {
      if (!value) return;
      var index = fragments.length;
      fragments.push(value);
      template.push(index);
    }
    // Capturing separators retains CRLF, CR, LF and runs of blank lines.
    var lines = String(original).split(/(\r\n|\r|\n)/);
    for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      if (lineIndex % 2) { literal(lines[lineIndex]); continue; }
      var line = lines[lineIndex];
      if (!line.trim()) { literal(line); continue; }
      var leading = (/^[ \t]*/.exec(line) || [""])[0];
      var trailing = (/[ \t]*$/.exec(line) || [""])[0];
      literal(leading);
      var rest = line.slice(leading.length, line.length - trailing.length);
      while (rest.length > maxChars) {
        var point = maxChars;
        // Prefer word boundaries. Preserve exactly the whitespace taken out.
        var probe = rest.slice(0, maxChars);
        var spaces = /[ \t]+/g, found, last = null;
        while ((found = spaces.exec(probe))) {
          if (found.index > maxChars / 3) last = found;
        }
        if (last) point = last.index;
        else if (point > 1 && /[\uD800-\uDBFF]/.test(rest.charAt(point - 1)) &&
                 /[\uDC00-\uDFFF]/.test(rest.charAt(point))) point--;
        translate(rest.slice(0, point));
        rest = rest.slice(point);
        var after = (/^[ \t]*/.exec(rest) || [""])[0];
        literal(after);
        rest = rest.slice(after.length);
      }
      translate(rest);
      literal(trailing);
    }
    return {fragments: fragments, template: template};
  }
  function restore(layout, translated) {
    if (!layout || !translated || translated.length !== layout.fragments.length)
      throw new Error("Incomplete multiline translation response");
    return layout.template.map(function(part) {
      if (typeof part === "string") return part;
      var result = translated[part];
      if (typeof result !== "string" || !result.trim())
        throw new Error("Missing translated text segment " + part);
      return result;
    }).join("");
  }
  return {plan: plan, restore: restore};
})();
