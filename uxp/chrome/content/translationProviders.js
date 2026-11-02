/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. See https://mozilla.org/MPL/2.0/.
 * Service selection; keeps providers independent from the page scheduler.
 */
var TWPUXPProviders = (function () {
  "use strict";
  var providers={google:TWPGoogleProvider,bing:TWPBingProvider,deepl:TWPDeepLProvider};
  function has(name) {return Object.prototype.hasOwnProperty.call(providers,name);}
  function get(name) {return has(name) ? providers[name] : providers.google;}
  function names() {return ['google','bing','deepl'];}
  return {has:has,get:get,names:names};
})();
