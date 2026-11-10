/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Native UXP chrome locale bundle. Never translate language codes or preference keys.
 */
var TWPUXPL10n = (function () {
  "use strict";
  var bundle = null, attempted = false;
  function get(key, fallback, args) {
    var result = fallback;
    if (!attempted) {
      attempted = true;
      try {
        bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
          .getService(Components.interfaces.nsIStringBundleService)
          .createBundle("chrome://twpuxp/locale/twp.properties");
      } catch (e) { bundle = null; }
    }
    if (bundle) try { result = bundle.GetStringFromName(key); } catch (ignored) {}
    if (args) for (var i = 0; i < args.length; ++i) {
      // Use a function rather than a replacement string: $ and backslashes in
      // translated text or site names must not be treated as substitution tokens.
      result = result.split("{" + i + "}").join(String(args[i]));
    }
    return result;
  }
  return {get:get};
})();
