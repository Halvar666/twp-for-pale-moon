/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// Pale Moon window integration: page state, popup menus, tabs and lifecycle.
var TWPUXPBrowserChrome = (function () {
  "use strict";
  function create(context, page, selection) {
  function L(key, fallback, args) {
    return typeof TWPUXPL10n !== "undefined" ?
      TWPUXPL10n.get(key, fallback, args) :
      (args ? args.reduce(function(s, item, i) {
        return s.split("{" + i + "}").join(String(item));
      }, fallback) : fallback);
  }

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

  // Site actions share the exact preference keys and match rules used by the
  // toolbar popup; there is no second domain registry or translation history.
  function exactHostRule(prefName, host) {
    return TWPUXPAutoRules.parseHosts(getString(prefName, ""), false).indexOf(host) !== -1;
  }
  function setExactHostRule(prefName, host, enabled) {
    var rules = TWPUXPAutoRules.parseHosts(getString(prefName, ""), false)
      .filter(function(rule) { return rule !== host; });
    if (enabled) rules.push(host);
    setString(prefName, rules.join("\n"));
  }
  function enableSiteAutoTranslation(host) {
    var info = getPageInfo();
    if (!info.supported || !host || info.host !== host) return;
    var enabled = !exactHostRule("autoTranslateSites", host);
    setExactHostRule("autoTranslateSites", host, enabled);
    if (enabled) {
      setExactHostRule("neverTranslateSites", host, false);
      prefs.setBoolPref(P + "autoTranslateEnabled", true);
      // Do not wait for a reload when the current page has not been translated.
      if (!info.running && !info.translated) translateCurrentPage();
    }
  }
  function forgetSiteTranslation(host) {
    var info = getPageInfo();
    if (!info.supported || !host || info.host !== host) return;
    // Forget exact site overrides, not other sites or the optional text cache.
    setExactHostRule("autoTranslateSites", host, false);
    setExactHostRule("neverTranslateSites", host, false);
    if (info.running || info.translated) restoreCurrentPage();
  }
  function installPageSelectionMenu() {
    var contextMenu = document.getElementById("contentAreaContextMenu");
    if (!contextMenu || document.getElementById("twpuxp-context-translate-selected")) return;
    var item = document.createElement("menuitem");
    item.id = "twpuxp-context-translate-selected";
    item.setAttribute("label", L("browser.selectionMenu", "Translate selected text (TWP)"));
    item.setAttribute("hidden", "true");
    item.addEventListener("command", function() {
      var selection = lastContextSelection;
      lastContextSelection = null;
      translateSelectedText(selection);
    }, false);
    contextMenu.appendChild(item);

    var siteMenu = document.createElement("menu");
    siteMenu.id = "twpuxp-context-site-menu";
    siteMenu.setAttribute("label", "TWP for Pale Moon");
    var submenu = document.createElement("menupopup");
    var translateItem = document.createElement("menuitem");
    translateItem.id = "twpuxp-context-translate-page";
    translateItem.setAttribute("label", L("browser.translatePage", "Translate page"));
    translateItem.addEventListener("command", function() { translateCurrentPage(); }, false);
    submenu.appendChild(translateItem);
    var alwaysItem = document.createElement("menuitem");
    alwaysItem.id = "twpuxp-context-always-site";
    alwaysItem.setAttribute("type", "checkbox");
    alwaysItem.addEventListener("command", function() {
      var info = getPageInfo();
      if (info.supported && info.host) enableSiteAutoTranslation(info.host);
    }, false);
    submenu.appendChild(alwaysItem);
    var forgetItem = document.createElement("menuitem");
    forgetItem.id = "twpuxp-context-forget-site";
    forgetItem.setAttribute("tooltiptext", L("browser.forgetTip", "Remove saved site translation rules and restore original text; the translation cache is unchanged."));
    forgetItem.addEventListener("command", function() {
      var info = getPageInfo();
      if (info.supported && info.host) forgetSiteTranslation(info.host);
    }, false);
    submenu.appendChild(forgetItem);
    var restoreItem = document.createElement("menuitem");
    restoreItem.id = "twpuxp-context-restore-page";
    restoreItem.setAttribute("label", L("browser.restorePage", "Restore original page"));
    restoreItem.addEventListener("command", restoreCurrentPage, false);
    submenu.appendChild(restoreItem);
    siteMenu.appendChild(submenu);
    contextMenu.appendChild(siteMenu);

    contextMenu.addEventListener("popupshowing", function(event) {
      if (event.target !== contextMenu) return;
      lastContextSelection = getSelectionInfo();
      item.hidden = !lastContextSelection;
      var info = getPageInfo();
      siteMenu.hidden = !info.supported || !info.host;
      if (!info.supported || !info.host) return;
      var auto = exactHostRule("autoTranslateSites", info.host);
      var blocked = exactHostRule("neverTranslateSites", info.host);
      alwaysItem.setAttribute("label", L("browser.alwaysHost", "Always translate {0}", [info.host]));
      alwaysItem.setAttribute("checked", auto ? "true" : "false");
      forgetItem.setAttribute("label", L("browser.forgetHost", "Forget translation for {0}", [info.host]));
      forgetItem.disabled = !auto && !blocked && !info.running && !info.translated;
      restoreItem.disabled = !info.running && !info.translated;
      translateItem.disabled = info.running;
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
    appendMenuItem(popup, L("browser.pagePreferred", "Translate page (preferred languages)"), function () { translateCurrentPage(); });
    appendMenuItem(popup, L("browser.autoCzech", "Auto-detect language → Czech"), function () { translateCurrentPage("auto", "cs"); });
    appendMenuItem(popup, L("browser.enCzech", "Translate English → Czech"), function () { translateCurrentPage("en", "cs"); });
    appendMenuItem(popup, L("browser.czechEn", "Translate Czech → English"), function () { translateCurrentPage("cs", "en"); });
    appendMenuItem(popup, L("browser.selectedMenu", "Translate selected text…"), translateSelectedText);
    appendMenuItem(popup, L("browser.restorePage", "Restore original page"), restoreCurrentPage);
    appendMenuItem(popup, L("browser.cancel", "Cancel translation"), cancelCurrentPage);
    var sepService = document.createElement("menuseparator"); popup.appendChild(sepService);
    var providerMenu = document.createElement("menu");
    providerMenu.setAttribute("label", L("browser.service", "Translation service"));
    var providerPopup = document.createElement("menupopup");
    var providerItems = {};
    [['google', L("browser.google", "Google Translate")], ['bing', L("browser.bing", "Bing Translator")],
     ['deepl', L("browser.deepl", "DeepL (experimental, unofficial)")]]
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
    appendMenuItem(popup, L("browser.toggleEngine", "Switch TWP / classic DOM engine"), toggleEngine);
    var dynamicItem = document.createElement("menuitem");
    dynamicItem.setAttribute("type", "checkbox");
    dynamicItem.setAttribute("label", L("browser.dynamic", "Translate dynamically loaded content"));
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
        status(page, (enabled ? L("browser.dynamicOn", "Dynamic translation enabled") : L("browser.dynamicOff", "Dynamic translation disabled")), false);
      }
    }, false);
    popup.appendChild(dynamicItem);
    var sep = document.createElement("menuseparator"); popup.appendChild(sep);
    appendMenuItem(popup, L("browser.preferences", "Translation preferences…"), openOptions);
    appendMenuItem(popup, L("browser.about", "About TWP for Pale Moon"), showAbout);

    host.appendChild(popup);
  }
  // Read the installed version from add-on metadata rather than maintaining a
  // hard-coded version string in the About dialog (previously stuck on a22).
  function showAbout() {
    var details = L("browser.aboutInfo",
      "Unofficial native UXP port of TWP – Translate Web Pages.\n" +
      "Google Translate, Bing Translator and optional experimental DeepL.\n" +
      "Provider endpoints are unofficial and may change.\n" +
      "Source license: MPL 2.0.\n" +
      "Original project: FilipePS / Traduzir-paginas-web.");
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
  // Keep toolbar placement separate from browser-event initialization.
  // Classic Pale Moon and Australis/CustomizableUI paths remain unchanged.
  function ensureToolbarButton() {
    try {
      if (prefs.getBoolPref(P + "toolbarInserted")) return;
    } catch (e) {}
    var toolbar = document.getElementById("nav-bar");
    var button = document.getElementById(BUTTON_ID);
    // Australis-style toolbars (e.g. Basilisk) have a separate customization
    // target and track widget placement in CustomizableUI. A button there is
    // NOT a direct child of nav-bar. The legacy insertItem() path would
    // therefore move it again on each startup, overwriting user placement.
    // Only use this guarded branch when a customizationtarget is declared;
    // Pale Moon's existing classic-toolbar path stays exactly as it was.
    if (toolbar && toolbar.getAttribute && toolbar.getAttribute("customizationtarget")) {
      try {
        var scope = {};
        Components.utils.import("resource:///modules/CustomizableUI.jsm", scope);
        var cui = scope.CustomizableUI;
        if (!cui || typeof cui.getPlacementOfWidget !== "function") return;
        // In any area (including a different toolbar, overflow or panel),
        // an existing placement is the user's choice: never move it.
        if (cui.getPlacementOfWidget(BUTTON_ID)) {
          prefs.setBoolPref(P + "toolbarInserted", true);
          return;
        }
        // First installation only: ask Australis to place the widget in its
        // own default area. Do not persist classic currentset on this path.
        if (!button || typeof cui.addWidgetToArea !== "function") return;
        cui.addWidgetToArea(BUTTON_ID, cui.AREA_NAVBAR || "nav-bar");
        if (cui.getPlacementOfWidget(BUTTON_ID))
          prefs.setBoolPref(P + "toolbarInserted", true);
      } catch (e2) {
        // If CustomizableUI cannot be accessed, leave user layout alone.
        // Never fall back to the classic insertItem() on Australis toolbars.
      }
      return;
    }
    // Classic Pale Moon toolbar placement is unchanged from b2a3.
    // Overlay buttons can exist in BrowserToolbarPalette before insertion.
    if (toolbar && toolbar.insertItem && button && button.parentNode !== toolbar) {
      try { toolbar.insertItem(BUTTON_ID, null); } catch (e3) { return; }
      try { toolbar.setAttribute("currentset", toolbar.currentSet); document.persist(toolbar.id, "currentset"); } catch (e4) {}
    }
    button = document.getElementById(BUTTON_ID);
    if (button && button.parentNode === toolbar) prefs.setBoolPref(P + "toolbarInserted", true);
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
    ensureToolbarButton();
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
