/* MPL-2.0. Cleanup 3: browser module separation and public runtime contract. */
'use strict';
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const content=path.join(root,'uxp/chrome/content');
const read=n=>fs.readFileSync(path.join(content,n),'utf8');
const overlay=read('browserOverlay.xul');
const modules=['pageController.js','selectionController.js','browserChrome.js','browser.js'];
const positions=modules.map(name=>overlay.indexOf('content/'+name));
assert(positions.every(n=>n>0) && positions.every((n,i)=>i===0 || n>positions[i-1]),
  'Factory scripts must precede the browser bootstrap in the XUL overlay');
assert.match(read('browser.js'), /TWPUXPPageController\.create\(context\)/);
assert.match(read('browser.js'), /TWPUXPSelectionController\.create\(context\)/);
assert.match(read('browser.js'), /TWPUXPBrowserChrome\.create\(context, page, selection\)/);
assert(!read('browser.js').includes('function translateCurrentPage('),
  'Do not move the translation scheduler back to the bootstrap');
assert(!read('browser.js').includes('function translateSelectedText('),
  'Keep selection translation separate from the bootstrap');
assert(!read('browser.js').includes('function buildPopup('),
  'Keep the context-menu UI separate from the bootstrap');
assert.match(read('pageController.js'), /function translateCurrentPage\(/);
assert.match(read('pageController.js'), /TWPUXPCache\.translatePieces/);
assert.match(read('selectionController.js'), /TWPUXPCache\.translateMany/);
assert.match(read('browserChrome.js'), /getAddonByID\("twp-uxp-prototype@unofficial\.local"/);
const callbacks={},prefs={getCharPref(){throw Error('default')},getBoolPref(){throw Error('default')},
 getIntPref(){throw Error('default')},setCharPref(){},setBoolPref(){}};
const context={WeakMap,Set,Map,Date,Math,Array,Error,setTimeout,clearTimeout,console,
 Components:{classes:{'@mozilla.org/preferences-service;1':{getService:()=>prefs}},
   interfaces:{nsIPrefBranch:{}}},
 window:{addEventListener:(name,cb)=>{callbacks[name]=cb},removeEventListener(){}},
 document:{getElementById:()=>null},gBrowser:{selectedBrowser:{contentDocument:null}}};
vm.createContext(context);
for(const name of modules)
 vm.runInContext(read(name),context,{filename:name});
const api=context.TWPUXP;
for(const name of ['translateCurrentPage','restoreCurrentPage','cancelCurrentPage',
 'translateSelectedText','getPageInfo','openOptions','onToolbarCommand',
 'onToolbarContext','configureOriginalHover'])
 assert.equal(typeof api[name],'function','Missing public TWPUXP.'+name);
assert.equal(typeof callbacks.load,'function','browser load handler missing');
assert.equal(typeof callbacks.unload,'function','browser unload handler missing');
assert.equal(api.getPageInfo().supported,false,'invalid tab must not be translatable');
console.log('PASS a30: overlay dependency order, modular API, no duplicate implementations, browser events');
