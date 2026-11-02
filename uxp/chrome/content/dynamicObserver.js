/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * UXP adapter for TWP's MutationObserver-based dynamic content translation.
 */
var TWPUXPDynamic = (function () {
  "use strict";
  // The host controls deduplication, translated-node filtering and batching.
  // This module only reports DOM subtrees/text changed by the page, debounced.
  function watch(doc, onChanges, ignoreText, ignoreAttribute) {
    if (!doc || !doc.body) return null;
    var win = doc.defaultView;
    var Observer = (win && win.MutationObserver) ||
                   (typeof MutationObserver !== "undefined" ? MutationObserver : null);
    if (!Observer) return null;
    var timer = null, pending = new Set(), active = true;
    var schedule = function () {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        if (!active || !pending.size) return;
        var roots = Array.from(pending);
        pending.clear();
        onChanges(roots);
      }, 450);
    };
    function shouldSkip(root, attributeMode) {
      var node = root;
      while (node && node !== doc) {
        if (node.nodeType === 1) {
          if (/^(SCRIPT|STYLE|NOSCRIPT|SELECT|CODE|PRE|KBD|SVG|MATH|IFRAME|TEMPLATE)$/i.test(node.nodeName) ||
            (!attributeMode && /^(INPUT|TEXTAREA)$/i.test(node.nodeName)) ||
            node.isContentEditable ||
            (node.getAttribute && (node.getAttribute("translate") === "no" || node.getAttribute("data-twpuxp-ignore") !== null)) ||
            (node.classList && node.classList.contains("notranslate"))) return true;
        }
        node = node.parentNode;
      }
      return false;
    }
    var observer = new Observer(function (mutations) {
      if (!active) return;
      mutations.forEach(function (mutation) {
        if (mutation.type === "childList") {
          for (var i = 0; i < mutation.addedNodes.length; i++) {
            var node = mutation.addedNodes[i];
            if ((node.nodeType === 1 || node.nodeType === 3) && !shouldSkip(node)) pending.add(node);
          }
        } else if (mutation.type === "attributes") {
          var element = mutation.target, name = mutation.attributeName;
          if (element && name && !shouldSkip(element, true) &&
              !(ignoreAttribute && ignoreAttribute(element, name))) pending.add(element);
        } else if (mutation.type === "characterData") {
          var text = mutation.target;
          if (text && text.nodeType === 3 && text.nodeValue && text.nodeValue.trim() &&
            !shouldSkip(text) && !(ignoreText && ignoreText(text))) pending.add(text);
        }
      });
      if (pending.size) schedule();
    });
    try { observer.observe(doc.body, {childList: true, characterData: true,
        attributes: true, attributeFilter: ["title", "alt", "placeholder", "aria-label", "aria-placeholder", "value"],
        subtree: true}); }
    catch (e) { return null; }
    return {stop: function () {
      active = false;
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
      pending.clear();
    }};
  }
  return {watch: watch};
})();
