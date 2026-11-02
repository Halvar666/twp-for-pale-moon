/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Optional original-on-hover feature, inspired by TWP showOriginal.js.
 * Does not replace DOM text, send network requests or store page text on disk.
 * Only exact, still-translated text nodes are eligible for the preview.
 */
var TWPUXPOriginalHover = (function () {
  "use strict";
  var DELAY = 280;
  var HTML_NS = "http://www.w3.org/1999/xhtml";

  function stop(state) {
    if (state.hoverSessions) {
      state.hoverSessions.forEach(function (session) {
        var doc = session.doc;
        doc.removeEventListener("mousemove", session.onMove, false);
        doc.removeEventListener("mouseout", session.onOut, false);
        doc.removeEventListener("scroll", session.onHide, true);
        doc.removeEventListener("mousedown", session.onHide, true);
        if (session.timer) clearTimeout(session.timer);
        if (session.tooltip && session.tooltip.parentNode)
          session.tooltip.parentNode.removeChild(session.tooltip);
      });
    }
    state.hoverSessions = null;
    state.hoverLookup = null;
  }

  function remember(state, entry) {
    if (state.hoverLookup && entry && entry.node && entry.node.nodeType === 3 &&
        typeof entry.original === "string" && typeof entry.translated === "string") {
      state.hoverLookup.set(entry.node, entry);
    }
  }

  function findEntry(doc, state, evt) {
    var map = state.hoverLookup;
    if (!map) return null;
    var target = evt.target;
    if (!target || (target.closest && target.closest('[data-twpuxp-ignore]'))) return null;
    var textNode = null;
    try {
      if (typeof doc.caretRangeFromPoint === "function") {
        var range = doc.caretRangeFromPoint(evt.clientX, evt.clientY);
        textNode = range && range.startContainer;
      } else if (typeof doc.caretPositionFromPoint === "function") {
        var caret = doc.caretPositionFromPoint(evt.clientX, evt.clientY);
        textNode = caret && caret.offsetNode;
      }
    } catch (e) { /* API may not be available on all UXP documents. */ }
    // Direct hit is exact. Do not guess a different nearby translated element.
    if (textNode && textNode.nodeType === 3) {
      var exact = map.get(textNode);
      return exact && exact.node.nodeValue === exact.translated ? exact : null;
    }
    // Fallback for UXP builds without a text-caret-at-point API. Check only
    // direct text children of the hovered element, never the whole document.
    if (target.nodeType === 3) target = target.parentNode;
    if (!target || !target.childNodes) return null;
    var found = null;
    for (var i = 0; i < target.childNodes.length; i++) {
      var child = target.childNodes[i];
      if (child.nodeType !== 3) continue;
      var entry = map.get(child);
      if (entry && child.nodeValue === entry.translated) {
        if (found) return null; // ambiguous element; do not show wrong text
        found = entry;
      }
    }
    return found;
  }

  function makeTooltip(doc) {
    var tooltip = doc.createElementNS ? doc.createElementNS(HTML_NS, "div") : doc.createElement("div");
    tooltip.setAttribute("data-twpuxp-ignore", "true");
    tooltip.setAttribute("role", "tooltip");
    tooltip.style.cssText =
      "display:none!important;position:fixed!important;z-index:2147483647!important;" +
      "pointer-events:none!important;max-width:420px!important;max-height:220px!important;" +
      "overflow:hidden!important;white-space:pre-wrap!important;overflow-wrap:break-word!important;" +
      "background:#25364d!important;color:#fff!important;border:1px solid #7c9bc2!important;" +
      "border-radius:5px!important;box-shadow:0 3px 10px rgba(0,0,0,.4)!important;" +
      "padding:8px 11px!important;font:13px/1.45 sans-serif!important;";
    doc.body.appendChild(tooltip);
    return tooltip;
  }

  function attach(doc, state) {
    if (!doc || !doc.body) return null;
    var session = {doc: doc, timer: null, active: null, shown: false, tooltip: null,
      x: 0, y: 0};
    function hide() {
      if (session.timer) { clearTimeout(session.timer); session.timer = null; }
      session.active = null;
      session.shown = false;
      if (session.tooltip) session.tooltip.style.display = "none";
    }
    function position() {
      if (!session.tooltip) return;
      var win = doc.defaultView;
      var width = win && win.innerWidth || 900;
      var height = win && win.innerHeight || 650;
      var boxWidth = session.tooltip.offsetWidth || 320;
      var boxHeight = session.tooltip.offsetHeight || 60;
      session.tooltip.style.left = Math.max(5, Math.min(session.x + 14, width - boxWidth - 8)) + "px";
      session.tooltip.style.top = Math.max(5, Math.min(session.y + 20, height - boxHeight - 8)) + "px";
    }
    function onMove(evt) {
      if (!evt || !evt.target || !evt.target.ownerDocument || evt.target.ownerDocument !== doc) {
        hide(); return;
      }
      var entry = findEntry(doc, state, evt);
      if (!entry || !entry.original || !entry.original.trim()) { hide(); return; }
      session.x = evt.clientX || 0;
      session.y = evt.clientY || 0;
      if (session.active === entry) {
        if (session.shown) position();
        return;
      }
      hide();
      session.active = entry;
      session.timer = setTimeout(function () {
        session.timer = null;
        if (session.active !== entry || entry.node.nodeValue !== entry.translated) return;
        if (!session.tooltip) session.tooltip = makeTooltip(doc);
        var original = entry.original.trim();
        // Avoid a huge tooltip obstructing the page; this does not truncate
        // any underlying translation or alter the stored original text.
        session.tooltip.textContent = original.length > 650 ? original.slice(0, 650) + "…" : original;
        session.tooltip.style.display = "block";
        session.shown = true;
        position();
      }, DELAY);
    }
    function onOut(evt) {
      if (!evt || !evt.relatedTarget) hide();
    }
    session.onMove = onMove;
    session.onOut = onOut;
    session.onHide = hide;
    doc.addEventListener("mousemove", onMove, false);
    doc.addEventListener("mouseout", onOut, false);
    doc.addEventListener("scroll", hide, true);
    doc.addEventListener("mousedown", hide, true);
    return session;
  }

  function start(topDoc, state, documents, enabled) {
    stop(state);
    if (!enabled || !topDoc || !state) return;
    state.hoverLookup = new WeakMap();
    state.originals.forEach(function (entry) { remember(state, entry); });
    state.hoverSessions = [];
    (documents || [topDoc]).forEach(function (doc) {
      var session = attach(doc, state);
      if (session) state.hoverSessions.push(session);
    });
  }
  return {start: start, stop: stop, remember: remember};
})();
