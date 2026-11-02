/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Privacy-hardened UXP network channel for all TWP translation requests.
 * Does not change the translation payload, service endpoints or IP route.
 */
var TWPUXPPrivacyXHR = (function () {
  "use strict";
  var PREF = "extensions.twpuxp.privacyEnhancedRequests";
  function enabled() {
    try {
      return Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch).getBoolPref(PREF);
    } catch (ignored) { return true; }
  }
  function failure(detail) {
    var err = new Error("TWP privacy mode: " + detail +
      ". No request sent. Disable 'Privacy-enhanced translation requests' in Preferences " +
      "only if you explicitly want standard requests.");
    err.privacyProtectionFailed = true;
    err.retryable = false;
    return err;
  }
  function create(method, url) {
    // Only direct HTTPS service endpoints. A site address is never used
    // here as a Referer, a request URL, or a query parameter.
    if (!/^https:\/\/[^\s\/?#]+(?:[\/?#]|$)/i.test(String(url)))
      throw failure("translation endpoint must use HTTPS");
    var anon = enabled();
    var req;
    if (anon) {
      // Use both the Firefox-era anonymous XHR option (when present) and
      // LOAD_ANONYMOUS on the underlying XPCOM channel. Chrome XHR support
      // for constructor options can vary in UXP, hence the channel check.
      try { req = new XMLHttpRequest({mozAnon:true}); }
      catch (ignored) { req = new XMLHttpRequest(); }
    } else {
      req = new XMLHttpRequest();
    }
    req.open(method, url, true);
    if (!anon) return req;

    var Ci, flag, channel;
    try {
      Ci = Components.interfaces;
      flag = Ci.nsIRequest.LOAD_ANONYMOUS;
      channel = req.channel;
      if (typeof flag !== "number" || !flag || !channel ||
          typeof channel.loadFlags !== "number")
        throw new Error("anonymous channel API unavailable");
      channel.loadFlags = channel.loadFlags | flag;
      if ((channel.loadFlags & flag) !== flag)
        throw new Error("anonymous channel flag was not accepted");
    } catch (err) {
      throw failure("cannot enable LOAD_ANONYMOUS (" + (err.message || err) + ")");
    }

    // An extension-owned XHR should not inherit the current page's URL.
    // Clear a channel referrer if set. Failure to clear a present referrer
    // aborts the request rather than claiming an unverified privacy guarantee.
    try {
      var http = channel.QueryInterface(Ci.nsIHttpChannel);
      if (http.referrer) {
        http.referrer = null;
        if (http.referrer) throw new Error("referrer remained set");
      }
    } catch (err) {
      throw failure("cannot verify an empty HTTP referrer (" + (err.message || err) + ")");
    }
    // withCredentials=false alone cannot protect a chrome-privileged XHR;
    // LOAD_ANONYMOUS above is the primary guard. This is defense in depth.
    try { req.withCredentials = false; } catch (ignored) { /* Platform-specific. */ }
    return req;
  }
  return {create:create, enabled:enabled};
})();
