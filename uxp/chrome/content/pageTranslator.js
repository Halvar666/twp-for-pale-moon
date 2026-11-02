/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * UXP adaptation of the paragraph grouping and DOM node selection of
 * upstream TWP src/contentScript/pageTranslator.js (v10.2.1.0).
 * Original work copyright FilipePS / TWP contributors.
 * Port-specific code: browser chrome context, node validity and rollback.
 */
var TWPUXPPageTranslator = (function () {
  "use strict";
  // TWP's inline element model, adapted for classic Gecko and simple HTML.
  var inline = /^(#text|A|ABBR|ACRONYM|B|BDO|BIG|CITE|DFN|EM|I|LABEL|Q|S|SMALL|SPAN|STRONG|SUB|SUP|U|TT|VAR)$/i;
  var ignored = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION|CODE|KBD|SAMP|SVG|MATH|IFRAME|CANVAS|TEMPLATE|BUTTON)$/i;
  var maxGroupChars = 780; // TWP groups nearby text; upstream request cap ~800 characters.

  function mustSkip(element, doc) {
    while (element && element !== doc) {
      if (element.nodeType === 1) {
        if (ignored.test(element.nodeName) ||
            element.isContentEditable ||
            (element.classList && (element.classList.contains('notranslate') ||
              element.classList.contains('CodeMirror'))) ||
            (element.getAttribute && (element.getAttribute('translate') === 'no' ||
              element.getAttribute('data-twpuxp-ignore') !== null))) return true;
      }
      element = element.parentNode;
    }
    return false;
  }

  // Like upstream TWP's getPiecesToTranslate, group adjacent inline text
  // within paragraph boundaries. 0 means no text-node limit. In contrast
  // to the first experimental port, all text on the page is collected.
  // Traverse with inherited skip state instead of repeatedly ascending the
  // ancestor chain for each text node on large/complex pages.
  function collect(doc, maxNodes, root, ignoreText) {
    if (!doc || !doc.body) return [];
    var pieces = [], current = [], currentChars = 0, found = 0;
    maxNodes = (typeof maxNodes === "number" && maxNodes > 0) ?
      Math.floor(maxNodes) : Infinity;
    function flush() {
      if (current.length) {
        pieces.push({nodes: current, originals: current.map(function(n) { return n.nodeValue; })});
      }
      current = []; currentChars = 0;
    }
    function ownSkip(node) {
      if (node.nodeType !== 1) return false;
      return ignored.test(node.nodeName) || node.isContentEditable ||
        (node.classList && (node.classList.contains('notranslate') ||
          node.classList.contains('CodeMirror'))) ||
        (node.getAttribute && (node.getAttribute('translate') === 'no' ||
          node.getAttribute('data-twpuxp-ignore') !== null));
    }
    function visit(node) {
      if (!node || found >= maxNodes) return;
      if (node.nodeType === 3) {
        var value = node.nodeValue;
        if (!value || !value.trim() || (ignoreText && ignoreText(node))) return;
        if (value.length > maxGroupChars) {
          flush();
          // Long text nodes remain intact; splitting their content into
          // smaller pieces without changing DOM geometry is a later task.
          pieces.push({nodes: [node], originals: [value]}); found++;
          return;
        }
        if (currentChars + value.length > maxGroupChars) flush();
        current.push(node); currentChars += value.length; found++;
        return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) return;
      if (ownSkip(node)) { flush(); return; }
      var boundary = node.nodeType === 1 && !inline.test(node.nodeName) && node !== doc.body;
      if (boundary) flush();
      var child = node.firstChild;
      while (child && found < maxNodes) {
        var next = child.nextSibling;
        visit(child);
        child = next;
      }
      if (boundary) flush();
    }
    root = root || doc.body;
    // Dynamic fragments may have been added under a `notranslate`, editor,
    // or script container. Check the ancestors outside the fragment too.
    if (root !== doc.body && mustSkip(root.parentNode, doc)) return [];
    visit(root); flush();
    return pieces;
  }

  // TWP prioritises content in the visible viewport so the page seems to
  // translate at once while off-screen paragraphs are still queued.
  // Preserve document order within each group. This is only scheduling:
  // we never discard off-screen text.
  function prioritizeVisible(pieces, doc) {
    var win = doc && doc.defaultView;
    if (!win || !win.innerHeight) return pieces;
    var visible = [], other = [], height = win.innerHeight;
    for (var i=0; i<pieces.length; i++) {
      var p = pieces[i];
      var el = p.nodes[0] && p.nodes[0].parentNode;
      try {
        var rect = el && el.getBoundingClientRect && el.getBoundingClientRect();
        if (rect && rect.bottom > -80 && rect.top < height + 80 && rect.width >= 0)
          visible.push(p);
        else other.push(p);
      } catch (e) { other.push(p); }
    }
    return visible.concat(other);
  }

  function apply(piece, translations, originalsLog) {
    if (!piece || !translations || translations.length !== piece.nodes.length)
      throw new Error('Translation count mismatch (expected ' + (piece ? piece.nodes.length : '?') + ')');
    var completed = 0;
    for (var i = 0; i < piece.nodes.length; i++) {
      var node = piece.nodes[i], old = piece.originals[i];
      if (!node.parentNode || node.nodeValue !== old) continue;
      var next = translations[i];
      if (typeof next !== 'string' || !next.trim()) continue;
      var trailing = (old.match(/\s*$/) || [''])[0];
      var leading = (old.match(/^\s*/) || [''])[0];
      var translated = leading + next.trim() + trailing;
      if (translated !== old) {
        originalsLog.push({node: node, original: old, translated: translated});
        node.nodeValue = translated;
        completed++;
      }
    }
    return completed;
  }
  return {collect: collect, prioritizeVisible: prioritizeVisible, apply: apply};
})();
