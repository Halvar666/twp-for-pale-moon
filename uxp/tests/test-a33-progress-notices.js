/* MPL-2.0. Beta preparation: optional on-page translation progress indicator. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
assert.match(read('uxp/defaults/preferences/defaults.js'),
  /pref\("extensions\.twpuxp\.showPageProgress", false\)/,
  'On-page progress must be off by default');
assert.match(read('uxp/chrome/content/options.xul'),
  /id="twpuxp-option-progress" label="Show on-page translation progress notices"/);
assert.match(read('uxp/chrome/content/options.js'),
  /setBoolPref\(PREFIX \+ "showPageProgress", progressEnabled\)/);
const nodes=new Map(), popupMessages=[], prefs=new Map();
const fakeDoc={body:{appendChild(el){nodes.set(el.id,el);el.parentNode=this;},
 removeChild(el){nodes.delete(el.id);el.parentNode=null;}},
 getElementById(id){return nodes.get(id)||null;},
 createElement(){return {id:'',setAttribute(){},style:{},parentNode:null,textContent:''};}};
let status;
const functions={translateCurrentPage(){},restoreCurrentPage(){},cancelCurrentPage(){},translateSelectedText(){},getPageInfo(){},openOptions(){},onToolbarCommand(){},onToolbarContext(){},configureOriginalHover(){}};
const ctx=vm.createContext({WeakMap,Set,Map,Date,Math,Array,Error,
 setTimeout:()=>1,clearTimeout:()=>{},
 gBrowser:{selectedBrowser:{contentDocument:fakeDoc}},
 TWPUXPPopup:{onStatus:(doc,msg,isError)=>popupMessages.push([doc,msg,isError])},
 TWPUXPPageController:{create(c){status=c.status;return functions;}},
 TWPUXPSelectionController:{create:()=>functions},
 TWPUXPBrowserChrome:{create:()=>functions},
 Components:{classes:{'@mozilla.org/preferences-service;1':{getService:()=>({
   getBoolPref(k){if(!prefs.has(k))throw Error('missing preference');return prefs.get(k)},
   getCharPref(){throw Error('no string')},getIntPref(){throw Error('no number')}
 })}},interfaces:{nsIPrefBranch:{}}}});
vm.runInContext(read('uxp/chrome/content/browser.js'),ctx,{filename:'browser.js'});
const api=ctx.TWPUXP;
assert.equal(typeof api.configureProgressIndicator,'function');
status(fakeDoc,'Translated 1/20',false);
assert.equal(nodes.size,0,'Default-off progress created a floating notice');
assert.equal(popupMessages.at(-1)[1],'Translated 1/20','Status not forwarded to popup');
prefs.set('extensions.twpuxp.showPageProgress',true);
status(fakeDoc,'Translated 2/20',false);
assert.equal(nodes.size,1,'Enabled progress should create floating notice');
assert.match(nodes.get('twpuxp-status-message').textContent,/Translated 2\/20/);
prefs.set('extensions.twpuxp.showPageProgress',false);
api.configureProgressIndicator(false);
assert.equal(nodes.size,0,'Disabling should clear existing non-error notice immediately');
status(fakeDoc,'Provider returned HTTP 502',true);
assert.equal(nodes.size,1,'Provider errors must remain visible even with progress disabled');
assert.match(nodes.get('twpuxp-status-message').style.cssText,/#7f2929/);
api.configureProgressIndicator(false);
assert.equal(nodes.size,1,'Disabling progress must not remove an important error');
status(fakeDoc,'Finished 20/20',false);
assert.equal(nodes.size,0,'Routine status should not leave behind an error notice');
assert.equal(popupMessages.length,4,'Each status update must reach popup independently');
console.log('PASS a33: on-page progress default off, popup state, errors, toggling, cleanup');
