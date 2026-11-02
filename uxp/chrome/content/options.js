/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var TWPOptions = (function () {
  "use strict";
  var PREFIX = "extensions.twpuxp.";
  var shortcuts = {toggle:"", selection:"", restore:""};
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);
  function byId(id) { return document.getElementById("twpuxp-option-" + id); }
  function getString(name, fallback) {
    try { return prefs.getCharPref(PREFIX + name); } catch (e) { return fallback; }
  }
  function getBool(name, fallback) {
    try { return prefs.getBoolPref(PREFIX + name); } catch (e) { return fallback; }
  }
  function getInt(name, fallback) {
    try { return prefs.getIntPref(PREFIX + name); } catch (e) { return fallback; }
  }
  function init() {
    var serviceList = byId('service');
    var wanted = getString('translationService','google');
    var services = serviceList.getElementsByTagName('menuitem');
    for (var i=0;i<services.length;i++) {
      if (services[i].getAttribute('value') === wanted) {
        serviceList.selectedItem = services[i]; break;
      }
    }
    if (!serviceList.selectedItem && services.length) serviceList.selectedItem = services[0];
    var service = TWPUXPLanguageMenus.value(serviceList);
    TWPUXPLanguageMenus.populate(byId("from"), true, service);
    TWPUXPLanguageMenus.populate(byId("to"), false, service);
    TWPUXPLanguageMenus.choose(byId("from"), getString("from", "auto"));
    TWPUXPLanguageMenus.choose(byId("to"), getString("to", "cs"));
    byId("autoenabled").checked = getBool("autoTranslateEnabled", false);
    byId("autosites").value = getString("autoTranslateSites", "");
    byId("neversites").value = getString("neverTranslateSites", "");
    byId("autolangs").value = getString("autoTranslateLanguages", "");
    byId("neverlangs").value = getString("neverTranslateLanguages", "");
    byId("privacy").checked = getBool("privacyEnhancedRequests", true);
    byId("diskcache").checked = getBool("persistentCacheEnabled", false);
    updateCacheCount();
    byId("dynamic").checked = getBool("translateDynamicContent", true);
    byId("attributes").checked = getBool("translatePageAttributes", true);
    byId("iframes").checked = getBool("translateIframes", true);
    byId("grouped").checked = getBool("useTwpParagraphEngine", true);
    if (byId("progress")) byId("progress").checked = getBool("showPageProgress", false);
    if (byId("hover")) byId("hover").checked = getBool("showOriginalOnHover", false);
    if (byId("shortcuts")) byId("shortcuts").checked = getBool("keyboardShortcutsEnabled", true);
    TWPUXPShortcutBindings.actions.forEach(function(action) {
      var model=TWPUXPShortcutBindings, raw=getString(model.names[action].slice(PREFIX.length), model.defaults[action]);
      try { shortcuts[action] = model.canonical(raw); }
      catch (ignored) { shortcuts[action] = model.canonical(model.defaults[action]); }
      renderShortcut(action);
    });
    byId("concurrency").value = getInt("concurrentRequests", 3);
    byId("batch").value = getInt("batchSize", 8);
    byId("maxnodes").value = getInt("maxNodes", 0);
  }
  function updateCacheCount() {
    var n = TWPUXPCache.count();
    byId("cachecount").value = String(n) + " stored translation" + (n === 1 ? "" : "s");
  }
  function clearCache() {
    if (!window.confirm("Delete all locally cached translations from this Pale Moon profile?")) return;
    var error = document.getElementById("twpuxp-options-error");
    if (!TWPUXPCache.clear()) error.textContent = "Failed to clear translation cache.";
    else error.textContent = "Stored translations cleared.";
    updateCacheCount();
  }
  function serviceChanged() {
    var service = TWPUXPLanguageMenus.value(byId("service"));
    var oldSource = TWPUXPLanguageMenus.value(byId("from"));
    var oldTarget = TWPUXPLanguageMenus.value(byId("to"));
    TWPUXPLanguageMenus.populate(byId("from"), true, service);
    TWPUXPLanguageMenus.populate(byId("to"), false, service);
    TWPUXPLanguageMenus.choose(byId("from"),
      TWPUXPLanguageMenus.has(oldSource, true, service) ? oldSource : "auto");
    TWPUXPLanguageMenus.choose(byId("to"),
      TWPUXPLanguageMenus.has(oldTarget, false, service) ? oldTarget : "cs");
    document.getElementById("twpuxp-options-error").textContent = "";
  }
  function swap() {
    var source = TWPUXPLanguageMenus.value(byId("from"));
    var target = TWPUXPLanguageMenus.value(byId("to"));
    if (source === "auto") {
      document.getElementById("twpuxp-options-error").textContent =
        "Select an explicit source language before swapping.";
      return;
    }
    TWPUXPLanguageMenus.choose(byId("from"), target);
    TWPUXPLanguageMenus.choose(byId("to"), source);
    document.getElementById("twpuxp-options-error").textContent = "";
  }
  function validNumber(name, min, max) {
    var value = String(byId(name).value).trim();
    if (!/^[0-9]+$/.test(value)) throw new Error("Enter a whole number for " + name);
    var number = Number(value);
    if (number < min || number > max) throw new Error(name + " must be between " + min + " and " + max);
    return number;
  }
  function shortcutField(action) { return document.getElementById("twpuxp-shortcut-input-" + action); }
  function shortcutError(message) {
    var element=document.getElementById("twpuxp-shortcut-error");
    if (element) { element.value=message || ""; element.textContent=message || ""; }
  }
  function renderShortcut(action) {
    var field=shortcutField(action);
    if (field) field.value=TWPUXPShortcutBindings.label(shortcuts[action]);
  }
  function setShortcut(action, value) {
    if (TWPUXPShortcutBindings.actions.indexOf(action)<0) return;
    value=TWPUXPShortcutBindings.canonical(value);
    var next={toggle:shortcuts.toggle,selection:shortcuts.selection,restore:shortcuts.restore};
    next[action]=value;
    try {TWPUXPShortcutBindings.validateSet(next);shortcutError("");}
    catch (e) {shortcutError(e.message);return;}
    shortcuts[action]=value;
    renderShortcut(action);
  }
  function captureShortcut(event,action) {
    var keyCode=Number(event.keyCode)||0;
    // Keep Tab available for moving focus through the Preferences dialog.
    if (keyCode===9) return;
    if (keyCode===27) {event.preventDefault();event.stopPropagation();shortcutError("");return;}
    if (keyCode===8 || keyCode===46) {
      event.preventDefault();event.stopPropagation();setShortcut(action,"");return;
    }
    event.preventDefault();event.stopPropagation();
    if (keyCode===16 || keyCode===17 || keyCode===18 || keyCode===91 || keyCode===92 || keyCode===93) return;
    var combo=TWPUXPShortcutBindings.fromEvent(event);
    if (!combo) {
      shortcutError("Press Ctrl, Alt or Meta with a letter, number, F-key or navigation key.");
      return;
    }
    setShortcut(action,combo);
  }
  function clearShortcut(action) {setShortcut(action,"");}
  function resetShortcut(action) {setShortcut(action,TWPUXPShortcutBindings.defaults[action]);}
  function save() {
    var error = document.getElementById("twpuxp-options-error");
    error.textContent = "";
    try {
      var source = TWPUXPLanguageMenus.value(byId("from"));
      var target = TWPUXPLanguageMenus.value(byId("to"));
      var serviceList = byId('service');
      var service = serviceList.selectedItem ? serviceList.selectedItem.getAttribute('value') : '';
      if (service !== 'google' && service !== 'bing' && service !== 'deepl')
        throw new Error('Choose a valid translation service.');
      if (!TWPUXPLanguageMenus.has(source, true, service) || !TWPUXPLanguageMenus.has(target, false, service))
        throw new Error('Choose languages supported by the selected service.');
      var autoSites = TWPUXPAutoRules.parseHosts(byId('autosites').value, true).join('\n');
      var neverSites = TWPUXPAutoRules.parseHosts(byId('neversites').value, true).join('\n');
      var autoLangs = TWPUXPAutoRules.parseLanguages(byId('autolangs').value, service, true).join(',');
      var neverLangs = TWPUXPAutoRules.parseLanguages(byId('neverlangs').value, service, true).join(',');
      var parallel = validNumber("concurrency", 1, 6);
      var batch = validNumber("batch", 1, 20);
      var limit = validNumber("maxnodes", 0, 1000000);
      var validatedShortcuts=TWPUXPShortcutBindings.validateSet(shortcuts);
      // Validate all inputs before modifying any persistent preference.
      prefs.setCharPref(PREFIX + "from", source);
      prefs.setCharPref(PREFIX + "to", target);
      prefs.setCharPref(PREFIX + "translationService", service);
      prefs.setBoolPref(PREFIX + "autoTranslateEnabled", byId("autoenabled").checked);
      prefs.setCharPref(PREFIX + "autoTranslateSites", autoSites);
      prefs.setCharPref(PREFIX + "neverTranslateSites", neverSites);
      prefs.setCharPref(PREFIX + "autoTranslateLanguages", autoLangs);
      prefs.setCharPref(PREFIX + "neverTranslateLanguages", neverLangs);
      prefs.setBoolPref(PREFIX + "privacyEnhancedRequests", byId("privacy").checked);
      prefs.setBoolPref(PREFIX + "persistentCacheEnabled", byId("diskcache").checked);
      prefs.setBoolPref(PREFIX + "translateDynamicContent", byId("dynamic").checked);
      prefs.setBoolPref(PREFIX + "translatePageAttributes", byId("attributes").checked);
      prefs.setBoolPref(PREFIX + "translateIframes", byId("iframes").checked);
      prefs.setBoolPref(PREFIX + "useTwpParagraphEngine", byId("grouped").checked);
      if (byId("progress")) {
        var progressEnabled = !!byId("progress").checked;
        prefs.setBoolPref(PREFIX + "showPageProgress", progressEnabled);
        try {
          if (window.opener && window.opener.TWPUXP &&
              typeof window.opener.TWPUXP.configureProgressIndicator === "function")
            window.opener.TWPUXP.configureProgressIndicator(progressEnabled);
        } catch (ignored) { /* Add-on manager window or closed opener. */ }
      }
      if (byId("shortcuts")) {
        TWPUXPShortcutBindings.actions.forEach(function(action){
          prefs.setCharPref(TWPUXPShortcutBindings.names[action],validatedShortcuts[action]);
        });
        prefs.setBoolPref(PREFIX + "keyboardShortcutsEnabled", !!byId("shortcuts").checked);
        // Immediate fallback for UXP builds that do not expose nsIPrefBranch2.
        try {
          if (window.opener && window.opener.TWPUXPShortcuts)
            window.opener.TWPUXPShortcuts.sync();
        } catch (ignored) {}
      }
      if (byId("hover")) {
        var hoverEnabled = !!byId("hover").checked;
        prefs.setBoolPref(PREFIX + "showOriginalOnHover", hoverEnabled);
        // The dialog is normally opened by the active browser window.
        // Apply the preview toggle immediately if that window is available.
        try {
          if (window.opener && window.opener.TWPUXP &&
              typeof window.opener.TWPUXP.configureOriginalHover === "function")
            window.opener.TWPUXP.configureOriginalHover(hoverEnabled);
        } catch (ignored) { /* Standalone add-on manager window. */ }
      }
      prefs.setIntPref(PREFIX + "concurrentRequests", parallel);
      prefs.setIntPref(PREFIX + "batchSize", batch);
      prefs.setIntPref(PREFIX + "maxNodes", limit);
      window.close();
    } catch (e) { error.textContent = e.message; }
  }
  return {init: init, swap: swap, save: save, serviceChanged: serviceChanged,
    clearCache: clearCache, captureShortcut:captureShortcut,
    clearShortcut:clearShortcut, resetShortcut:resetShortcut};
})();
