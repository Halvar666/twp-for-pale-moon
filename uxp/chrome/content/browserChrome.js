/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// Pale Moon window integration: page state, popup menus, tabs and lifecycle.
var TWPUXPBrowserChrome = (function () {
  "use strict";
  function create(context, page, selection) {
  var BUTTON_ID = "twpuxp-page-button", MENU_ID = "twpuxp-context-menu";
  var P = context.P, prefs = context.prefs;
  var getDoc = context.getDoc, getState = context.getState;
  var getBool = context.getBool, getInt = context.getInt;
  var getString = context.getString, setString = context.setString;
  var status = context.status;
  var translateCurrentPage = page.translateCurrentPage;
  var restoreCurrentPage = page.restoreCurrentPage;
  var cancelCurrentPage = page.cancelCurrentPage;
  var startDynamic = page.startDynamic, stopDynamic = page.stopDynamic;
  var toggleEngine = page.toggleEngine;
  var translateSelectedText = selection.translateSelectedText;
  var getSelectionInfo = selection.getSelectionInfo;
  var states = context.states;
  var popup = null, lastContextSelection = null;
  // Public read-only view of the selected tab, used by the native XUL popup.
  // Do not expose the mutable WeakMap state or content document to XUL controls.
  function getPageInfo() {
    var doc = getDoc();
    if (!doc) return {document: null, supported: false, host: "",
      running: false, translated: false, detected: "auto"};
    var supported = false, host = "", detected = "auto";
    try {
      supported = !!doc.body && /^https?:$/.test(doc.location.protocol);
      if (supported) host = TWPUXPAutoRules.normalizeHost(doc.location.hostname);
      if (supported) detected = TWPUXPLanguage.detect(doc);
    } catch (e) { supported = false; }
    var state = getState(doc);
    return {document: doc, supported: supported, host: host,
      running: !!state.running, translated: !!state.originals.length,
      detected: detected, source: state.source, target: state.target,
      service: state.service};
  }
  function onToolbarCommand(event) {
    // Upstream-like popup on normal click. Keep the old immediate translation
    // on Ctrl+click (and Shift+click), useful for one-click power users.
    if (event && (event.ctrlKey || event.shiftKey)) {
      translateCurrentPage(); return;
    }
    var button = document.getElementById(BUTTON_ID);
    if (!TWPUXPPopup.open(button)) translateCurrentPage();
  }

  // Automatic translation is opt-in. Never process background frames or chrome
  // documents. A page is attempted once per Document (not every TabSelect).
  function maybeAutoTranslate(doc) {
    if (!getBool('autoTranslateEnabled', false) || !doc || doc !== getDoc() ||
        !doc.body || !doc.location || !/^https?:$/.test(doc.location.protocol)) return;
    var state = getState(doc);
    if (state.autoAttempted || state.running || state.originals.length) return;
    var host = '';
    try { host = doc.location.hostname; } catch(e) { return; }
    var source = TWPUXPLanguage.detect(doc);
    var target = getString('to', 'cs');
    var service = getString('translationService', 'google');
    var languages = TWPUXPAutoRules.parseLanguages(
      getString('autoTranslateLanguages', ''), service, false);
    var neverLanguages = TWPUXPAutoRules.parseLanguages(
      getString('neverTranslateLanguages', ''), service, false);
    if (!TWPUXPAutoRules.shouldTranslate(host, source, target,
        getString('autoTranslateSites', ''), getString('neverTranslateSites', ''),
        languages, neverLanguages)) return;
    state.autoAttempted = true;
    translateCurrentPage('auto', target, {doc: doc, automatic: true});
  }
  function onPageLoaded(event) {
    var doc = event && event.target;
    if (!doc || doc !== getDoc()) return;
    setTimeout(function () { maybeAutoTranslate(doc); }, 350);
  }
  function onSelectedTab() {
    var doc = getDoc();
    setTimeout(function () { maybeAutoTranslate(doc); }, 350);
  }

  function installPageSelectionMenu() {
    var contextMenu = document.getElementById("contentAreaContextMenu");
    if (!contextMenu || document.getElementById("twpuxp-context-translate-selected")) return;
    var item = document.createElement("menuitem");
    item.id = "twpuxp-context-translate-selected";
    item.setAttribute("label", "Translate selected text (TWP)");
    item.setAttribute("hidden", "true");
    item.addEventListener("command", function() {
      var selection = lastContextSelection;
      lastContextSelection = null;
      translateSelectedText(selection);
    }, false);
    contextMenu.appendChild(item);
    contextMenu.addEventListener("popupshowing", function(event) {
      if (event.target !== contextMenu) return;
      lastContextSelection = getSelectionInfo();
      item.hidden = !lastContextSelection;
    }, false);
  }

  function openOptions() {
    window.openDialog("chrome://twpuxp/content/options.xul", "twpuxp-options",
      "chrome,centerscreen,resizable,dialog=no,width=610,height=690");
  }
  function appendMenuItem(popupEl, label, command) {
    var item = document.createElement("menuitem");
    item.setAttribute("label", label);
    item.addEventListener("command", command, false);
    popupEl.appendChild(item);
  }
  function buildPopup() {
    if (document.getElementById(MENU_ID)) { popup = document.getElementById(MENU_ID); return; }
    var host = document.getElementById("mainPopupSet") || document.getElementsByTagName("popupset")[0];
    if (!host) { host = document.createElement("popupset"); document.documentElement.appendChild(host); }
    popup = document.createElement("menupopup"); popup.id = MENU_ID;
    appendMenuItem(popup, "Translate page (preferred languages)", function () { translateCurrentPage(); });
    appendMenuItem(popup, "Auto-detect language → Czech", function () { translateCurrentPage("auto", "cs"); });
    appendMenuItem(popup, "Translate English → Czech", function () { translateCurrentPage("en", "cs"); });
    appendMenuItem(popup, "Translate Czech → English", function () { translateCurrentPage("cs", "en"); });
    appendMenuItem(popup, "Translate selected text…", translateSelectedText);
    appendMenuItem(popup, "Restore original page", restoreCurrentPage);
    appendMenuItem(popup, "Cancel translation", cancelCurrentPage);
    var sepService = document.createElement("menuseparator"); popup.appendChild(sepService);
    var providerMenu = document.createElement("menu");
    providerMenu.setAttribute("label", "Translation service");
    var providerPopup = document.createElement("menupopup");
    var providerItems = {};
    [['google', 'Google Translate'], ['bing', 'Bing Translator'],
     ['deepl', 'DeepL (experimental, unofficial)']]
      .forEach(function(entry) {
        var item = document.createElement('menuitem');
        item.setAttribute('label', entry[1]);
        item.setAttribute('type', 'radio');
        item.setAttribute('name', 'twpuxp-service');
        item.addEventListener('command', function () {
          setString('translationService', entry[0]);
        }, false);
        providerItems[entry[0]] = item;
        providerPopup.appendChild(item);
      });
    providerPopup.addEventListener('popupshowing', function(e) {
      if (e.target !== providerPopup) return;
      var chosen = getString('translationService', 'google');
      for (var name in providerItems) {
        providerItems[name].setAttribute('checked', name === chosen ? 'true' : 'false');
      }
    },false);
    providerMenu.appendChild(providerPopup);
    popup.appendChild(providerMenu);
    var sepEngine = document.createElement("menuseparator"); popup.appendChild(sepEngine);
    appendMenuItem(popup, "Switch TWP / classic DOM engine", toggleEngine);
    var dynamicItem = document.createElement("menuitem");
    dynamicItem.setAttribute("type", "checkbox");
    dynamicItem.setAttribute("label", "Translate dynamically loaded content");
    dynamicItem.setAttribute("checked", getBool("translateDynamicContent", true) ? "true" : "false");
    dynamicItem.addEventListener("command", function () {
      var enabled = !getBool("translateDynamicContent", true);
      prefs.setBoolPref(P + "translateDynamicContent", enabled);
      dynamicItem.setAttribute("checked", enabled ? "true" : "false");
      var page = getDoc();
      if (page) {
        var currentState = getState(page);
        if (enabled && currentState.source && currentState.originals.length && !currentState.observer)
          startDynamic(page, currentState);
        if (!enabled) stopDynamic(currentState);
        status(page, "Dynamic translation " + (enabled ? "enabled" : "disabled"), false);
      }
    }, false);
    popup.appendChild(dynamicItem);
    var sep = document.createElement("menuseparator"); popup.appendChild(sep);
    appendMenuItem(popup, "Translation preferences…", openOptions);
    appendMenuItem(popup, "About TWP for Pale Moon", showAbout);

    host.appendChild(popup);
  }
  // Read the installed version from add-on metadata rather than maintaining a
  // hard-coded version string in the About dialog (previously stuck on a22).
  function showAbout() {
    var details = "Unofficial native UXP port of TWP – Translate Web Pages.\n" +
      "Google Translate, Bing Translator and optional experimental DeepL.\n" +
      "Provider endpoints are unofficial and may change.\n" +
      "Source license: MPL 2.0.\n" +
      "Original project: FilipePS / Traduzir-paginas-web.";
    function display(version) {
      window.alert("TWP for Pale Moon" + (version ? " " + version : "") +
        "\n\n" + details);
    }
    try {
      var namespace = {};
      Components.utils.import("resource://gre/modules/AddonManager.jsm", namespace);
      namespace.AddonManager.getAddonByID("twp-uxp-prototype@unofficial.local", function(addon) {
        display(addon && addon.version ? addon.version : "");
      });
    } catch (e) { display(""); }
  }

  function onToolbarContext(event) {
    if (event && event.button !== 2) return true;
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!popup) buildPopup();
    if (popup) {
      try { popup.openPopup(event.currentTarget, "after_start", 0, 0, true, false, event); }
      catch (e) { try { popup.openPopupAtScreen(event.screenX, event.screenY, true); } catch (e2) { } }
    }
    return false;
  }
  function onLoad() {
    // Migrate the previous default limit if stored as a user pref. Other
    // deliberate nondefault limits are preserved. New default is 0 (all).
    try {
      if (!getBool("unlimitedNodesMigrationA4", false)) {
        if (prefs.prefHasUserValue(P + "maxNodes") && getInt("maxNodes", 0) === 120)
          prefs.clearUserPref(P + "maxNodes");
        prefs.setBoolPref(P + "unlimitedNodesMigrationA4", true);
      }
    } catch (e) {}
    buildPopup();
    installPageSelectionMenu();
    try {
      if (gBrowser) {
        gBrowser.addEventListener('DOMContentLoaded', onPageLoaded, true);
        if (gBrowser.tabContainer)
          gBrowser.tabContainer.addEventListener('TabSelect', onSelectedTab, false);
      }
      onSelectedTab();
    } catch(e) {}
    try {
      if (prefs.getBoolPref(P + "toolbarInserted")) return;
    } catch (e) {}
    var toolbar = document.getElementById("nav-bar");
    var button = document.getElementById(BUTTON_ID);
    // XUL overlay buttons normally exist in BrowserToolbarPalette even before
    // they are inserted into a live toolbar; their presence alone is NOT proof
    // that Customize Toolbar placed the item. Always inspect parentNode.
    if (toolbar && toolbar.insertItem && button && button.parentNode !== toolbar) {
      try { toolbar.insertItem(BUTTON_ID, null); } catch (e2) { return; }
      try { toolbar.setAttribute("currentset", toolbar.currentSet); document.persist(toolbar.id, "currentset"); } catch (e3) {}
    }
    button = document.getElementById(BUTTON_ID);
    if (button && button.parentNode === toolbar) prefs.setBoolPref(P + "toolbarInserted", true);
  }
  window.addEventListener("load", onLoad, false);
  window.addEventListener("unload", function () {
    window.removeEventListener("load", onLoad, false);
    try { TWPUXPCache.close(); } catch (ignored) {}
    try {
      for (var i = 0; i < gBrowser.browsers.length; i++) {
        var d = gBrowser.browsers[i].contentDocument;
        if (d && states.has(d) && typeof TWPUXPOriginalHover !== "undefined")
          TWPUXPOriginalHover.stop(states.get(d));
      }
    } catch (ignoredHover) {}
    try {
      gBrowser.removeEventListener('DOMContentLoaded', onPageLoaded, true);
      if (gBrowser.tabContainer) gBrowser.tabContainer.removeEventListener('TabSelect', onSelectedTab, false);
    } catch(e) {}
  }, false);
  return {getPageInfo: getPageInfo,
    onToolbarCommand: onToolbarCommand, onToolbarContext: onToolbarContext,
    openOptions: openOptions};
  }
  return {create: create};
})();
