/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Adaptation of the attribute-translation approach in upstream TWP
 * src/contentScript/pageTranslator.js, for XUL/UXP DOM text scheduling.
 * Attribute descriptors expose a text-node-like interface so that page
 * translation, throttling, cache, and rollback share one state machine.
 */
var TWPUXPAttributes = (function () {
  "use strict";
  var descriptors = new WeakMap();
  var names = ["title", "alt", "placeholder", "aria-label", "aria-placeholder"];
  function makeDescriptor(element, name) {
    var attrNodes = descriptors.get(element);
    if (!attrNodes) { attrNodes = {}; descriptors.set(element, attrNodes); }
    if (attrNodes[name]) return attrNodes[name];
    var record = {kind: "attribute", element: element, attributeName: name};
    Object.defineProperty(record, "nodeValue", {
      enumerable: true,
      get: function () { return element.getAttribute(name) || ""; },
      set: function (value) { element.setAttribute(name, value); }
    });
    Object.defineProperty(record, "parentNode", {
      enumerable: true,
      get: function () { return element.parentNode; }
    });
    attrNodes[name] = record;
    return record;
  }
  function eligible(element) {
    for (var node = element; node && node.nodeType === 1; node = node.parentNode) {
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|SVG|MATH|IFRAME|TEMPLATE|CODE|PRE)$/i.test(node.nodeName) ||
          node.isContentEditable ||
          (node.hasAttribute && (node.hasAttribute("data-twpuxp-ignore") || node.getAttribute("translate") === "no")) ||
          (node.classList && node.classList.contains("notranslate"))) return false;
    }
    return true;
  }
  function collect(doc, root, ignore, maxNodes) {
    if (!doc || !doc.body) return [];
    root = root || doc.body;
    var limit = maxNodes > 0 ? maxNodes : Infinity;
    var pieces = [];
    function inspect(element) {
      if (pieces.length >= limit || !eligible(element)) return;
      var list = names.slice();
      if (/^INPUT$/i.test(element.nodeName) && /^(button|submit|reset)$/i.test(element.getAttribute("type") || ""))
        list.push("value");
      for (var i = 0; i < list.length && pieces.length < limit; i++) {
        var name = list[i];
        var raw = element.getAttribute(name);
        if (!raw || !raw.trim()) continue;
        var node = makeDescriptor(element, name);
        if (ignore && ignore(node)) continue;
        pieces.push({nodes: [node], originals: [raw]});
      }
    }
    function visit(element) {
      if (!element || pieces.length >= limit || element.nodeType !== 1 || !eligible(element)) return;
      inspect(element);
      for (var child = element.firstChild; child && pieces.length < limit; child = child.nextSibling) {
        if (child.nodeType === 1) visit(child);
      }
    }
    if (root.nodeType === 3) root = root.parentNode;
    if (root && root.nodeType === 1) visit(root);
    return pieces;
  }
  return {collect: collect, descriptor: makeDescriptor};
})();
