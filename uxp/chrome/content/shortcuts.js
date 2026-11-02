/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Configurable native XUL shortcuts; no WebExtension commands API.
 */
var TWPUXPShortcuts = (function () {
  "use strict";
  var prefix = "extensions.twpuxp.";
  var enabledPref = prefix + "keyboardShortcutsEnabled";
  var model = TWPUXPShortcutBindings;
  var prefService = Components.classes["@mozilla.org/preferences-service;1"];
  var branch = prefService.getService(Components.interfaces.nsIPrefBranch);
  var observerBranch = null, observed = false;
  var ids = {toggle: "twpuxp-shortcut-toggle", selection: "twpuxp-shortcut-selection",
             restore: "twpuxp-shortcut-restore"};
  var observer = {observe: function (subject, topic, data) {
    if (topic !== "nsPref:changed") return;
    if (data === enabledPref || data === model.names.toggle ||
        data === model.names.selection || data === model.names.restore) sync();
  }};
  function enabled() {
    try { return branch.getBoolPref(enabledPref); } catch (e) { return true; }
  }
  function readBindings() {
    var bindings={}, used=Object.create(null);
    model.actions.forEach(function(action){
      var value = model.defaults[action];
      try { value = model.canonical(branch.getCharPref(model.names[action])); }
      catch (ignored) { value = model.canonical(model.defaults[action]); }
      // Externally edited/corrupted duplicate preferences must not shadow actions.
      if (value && used[value]) value = "";
      used[value] = true;
      bindings[action]=value;
    });
    return bindings;
  }
  function sync() {
    var active = enabled(), bindings = readBindings();
    var keyset = document.getElementById("mainKeyset"), changed = false;
    if (!keyset) return false;
    model.actions.forEach(function(action) {
      var key = document.getElementById(ids[action]);
      if (!key) return;
      if (key.parentNode !== keyset) { keyset.appendChild(key); changed = true; }
      var parts = model.unpack(active ? bindings[action] : "");
      var desired = {modifiers:parts.modifiers, key:parts.key, keycode:parts.keycode,
                     disabled: active && bindings[action] ? "" : "true"};
      var current = {modifiers:key.getAttribute("modifiers") || "",
                     key:key.getAttribute("key") || "", keycode:key.getAttribute("keycode") || "",
                     disabled:key.getAttribute("disabled") || ""};
      if (Object.keys(desired).every(function(name){return desired[name] === current[name];})) return;
      // Replace the <key>, not just its attributes; old XUL key handlers may
      // otherwise survive a binding change even after refreshing the keyset.
      var replacement = key.cloneNode(false);
      Object.keys(desired).forEach(function(name) {
        if (desired[name]) replacement.setAttribute(name, desired[name]);
        else replacement.removeAttribute(name);
      });
      keyset.replaceChild(replacement, key);
      changed = true;
    });
    // XUL key bindings are registered on the keyset. Reinsert it exactly once
    // after changes to apply them immediately, not just on browser restart.
    if (changed && keyset.parentNode) keyset.parentNode.appendChild(keyset);
    return active;
  }
  function run(action) {
    if (!enabled() || !model.actions.some(function(a){return a === action && !!readBindings()[a];})) return false;
    if (typeof TWPUXP === "undefined") return false;
    if (action === "selection") {TWPUXP.translateSelectedText(); return true;}
    if (action === "restore") {
      var current = TWPUXP.getPageInfo();
      if (!current || (!current.running && !current.translated)) return false;
      TWPUXP.restoreCurrentPage(); return true;
    }
    if (action === "toggle") {
      var info = TWPUXP.getPageInfo();
      if (!info || !info.supported) return false;
      if (info.running) TWPUXP.cancelCurrentPage();
      else if (info.translated) TWPUXP.restoreCurrentPage();
      else TWPUXP.translateCurrentPage();
      return true;
    }
    return false;
  }
  function init() {
    sync();
    try {
      observerBranch = prefService.getService(Components.interfaces.nsIPrefBranch2);
      // Observe the namespace so new bindings and enabled flags propagate to
      // all open Pale Moon windows without requiring a browser restart.
      observerBranch.addObserver(prefix, observer, false);
      observed = true;
    } catch (e) { /* Fallback: opener applies settings immediately. */ }
  }
  function shutdown() {
    if (observed && observerBranch) {
      try { observerBranch.removeObserver(prefix, observer); } catch (e) {}
    }
    observed = false; observerBranch = null;
  }
  window.addEventListener("load", init, false);
  window.addEventListener("unload", shutdown, false);
  return {run:run, sync:sync, shutdown:shutdown, readBindings:readBindings};
})();
