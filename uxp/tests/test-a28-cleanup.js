/* MPL-2.0. Cleanup 1: user-facing naming and theme-independent toolbar contract. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'../..');
function read(f){return fs.readFileSync(path.join(root,f),'utf8');}
const install=read('uxp/install.rdf');
assert.match(install,/<em:name>TWP for Pale Moon<\/em:name>/);
assert.match(install,/<em:version>\d+\.\d+\.\d+(?:a\d+|b\d+(?:a\d+)?|rc\d+)?<\/em:version>/);
assert.match(install,/<em:id>twp-uxp-prototype@unofficial\.local<\/em:id>/,
  'Compatibility: never change the existing add-on ID');
assert.doesNotMatch(install,/<em:name>[^<]*(Experimental|Prototype)/i);
const manifest=read('uxp/chrome.manifest');
for(const url of ['chrome://browser/content/browser.xul',
                  'chrome://global/content/customizeToolbar.xul']){
  assert.ok(manifest.includes('style '+url+' chrome://twpuxp/skin/toolbarButton.css'));
}
assert.ok(!manifest.includes('overlay.css'));
const overlay=read('uxp/chrome/content/browserOverlay.xul');
assert.match(overlay, /<\?xml-stylesheet href="chrome:\/\/twpuxp\/skin\/toolbarButton.css"/);
assert.match(overlay, /id="twpuxp-page-button"/);
const css=read('uxp/chrome/skin/toolbarButton.css');
assert.match(css, /#twpuxp-page-button\s*,\s*#wrapper-twpuxp-page-button/);
assert.match(css, /-moz-image-region:\s*auto\s*!important/);
assert.match(css, /chrome:\/\/twpuxp\/skin\/icon-16.png/);
assert.match(css, /chrome:\/\/twpuxp\/skin\/icon-24.png/);
assert.doesNotMatch(css, /^\s*(?:toolbar|toolbarbutton|\.toolbarbutton-icon)\s*\{/m);
assert.doesNotMatch(css, /(?:min-|max-)?(?:width|height)\s*:/);
assert.ok(!fs.existsSync(path.join(root,'uxp/chrome/skin/overlay.css')));
assert.ok(!fs.existsSync(path.join(root,'tools/build_xpi.py')));
const browser=read('uxp/chrome/content/browserChrome.js');
assert.match(browser,/About TWP for Pale Moon/);
assert.match(browser,/getAddonByID\("twp-uxp-prototype@unofficial.local"/);
assert.doesNotMatch(browser,/About prototype|0\.0\.1a22/);
assert.doesNotMatch(browser,/Google Translate \(experimental\)|Bing Translator \(experimental\)/);
const options=read('uxp/chrome/content/options.xul');
assert.match(options,/Privacy-enhanced translation requests \(recommended\)/);
assert.match(options,/DeepL \(experimental/);
assert.doesNotMatch(options, /Google Translate \(experimental\)|Bing Translator \(experimental\)/);
assert.doesNotMatch(options,/UXP translation preferences \(experimental\)/);
const selection=read('uxp/chrome/content/selectionResult.xul');
assert.doesNotMatch(selection, /Google Translate \(experimental\)|Bing Translator \(experimental\)/);
assert.match(read('uxp/defaults/preferences/defaults.js'), /privacyEnhancedRequests", true/);
for(const name of ['UXP-PORT-README.md','CHANGELOG-UXP.md','docs/DEVELOPMENT-HISTORY.md','docs/PRIVACY-UXP.md'])
  assert.ok(fs.statSync(path.join(root,name)).size>150);
console.log('PASS a28 Cleanup 1: metadata, About, scoped toolbar stylesheet, unchanged prefs and docs');
