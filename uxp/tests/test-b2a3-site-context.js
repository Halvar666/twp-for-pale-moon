/* MPL-2.0. b2a3 browser page context actions and existing rule compatibility. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const base=path.resolve(__dirname,'../chrome/content');
class Node {
 constructor(tag,id=''){this.tag=tag;this.id=id;this.children=[];this.attrs={};this.events={};this.hidden=false;this.disabled=false;this.parentNode=null;}
 appendChild(child){this.children.push(child);child.parentNode=this;return child;}
 addEventListener(type,callback){(this.events[type]||(this.events[type]=[])).push(callback);}
 setAttribute(key,value){this.attrs[key]=String(value);if(key==='hidden')this.hidden=String(value)==='true';}
 getAttribute(key){return this.attrs[key]||'';}
 getElementsByTagName(name){return this.children.flatMap(c=>(c.tag===name?[c]:[]).concat(c.getElementsByTagName(name)));}
 fire(name,evt){for(const fn of (this.events[name]||[])) fn(evt||{target:this});}
 find(id){if(this.id===id)return this;for(const c of this.children){const v=c.find(id);if(v)return v;}return null;}
}
const root=new Node('window','root'),popupset=new Node('popupset','mainPopupSet'),menu=new Node('menupopup','contentAreaContextMenu');
root.appendChild(popupset);root.appendChild(menu);
const prefs=new Map([
 ['autoTranslateEnabled',false],['toolbarInserted',true],['to','cs'],['from','auto'],['translationService','google'],
 ['autoTranslateSites','other.example\nsub.example.com'],['neverTranslateSites','blocked.example'],['translateDynamicContent',false]
]);
const prefObj={setBoolPref(name,v){prefs.set(name.slice('extensions.twpuxp.'.length),v)},getBoolPref(name){return prefs.get(name.slice('extensions.twpuxp.'.length))}};
const context={P:'extensions.twpuxp.',prefs:prefObj,getDoc(){return doc;},getState(){return state;},getBool(k,d){return prefs.has(k)?prefs.get(k):d},getInt(){return 1},getString(k,d){return prefs.has(k)?prefs.get(k):d},setString(k,v){prefs.set(k,v)},status(){},states:new WeakMap()};
const doc={body:{},location:{protocol:'https:',hostname:'example.com',port:''},documentElement:{}};
const state={running:false,originals:[],source:'',target:''};
const calls=[];
const page={translateCurrentPage(){calls.push('translate')},restoreCurrentPage(){calls.push('restore');state.originals=[];state.running=false;},cancelCurrentPage(){calls.push('cancel')},startDynamic(){},stopDynamic(){},toggleEngine(){}};
const selection={getSelectionInfo(){return null},translateSelectedText(){calls.push('selection')}};
const winEvents={};
const ctx=vm.createContext({
 window:{addEventListener(name,cb){winEvents[name]=cb},removeEventListener(){},alert(){}},
 document:{documentElement:root,getElementById:id=>root.find(id),createElement:tag=>new Node(tag),getElementsByTagName:tag=>root.getElementsByTagName(tag)},
 gBrowser:{addEventListener(){},removeEventListener(){},tabContainer:{addEventListener(){},removeEventListener(){}}},
 TWPUXPLanguage:{detect(){return 'ja'}},TWPUXPLanguageCatalog:{has(){return true}},
 setTimeout(){},console
});
vm.runInContext(fs.readFileSync(path.join(base,'autoRules.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(base,'browserChrome.js'),'utf8'),ctx);
ctx.TWPUXPBrowserChrome.create(context,page,selection);
assert.equal(typeof winEvents.load,'function');winEvents.load();
const sub=root.find('twpuxp-context-site-menu');
const always=root.find('twpuxp-context-always-site');
const forget=root.find('twpuxp-context-forget-site');
const restore=root.find('twpuxp-context-restore-page');
const translate=root.find('twpuxp-context-translate-page');
assert.ok(sub && always && forget && restore && translate,'submenu must be installed once');
menu.fire('popupshowing',{target:menu});
assert.equal(sub.hidden,false);
assert.equal(always.getAttribute('label'),'Always translate example.com');
assert.equal(always.getAttribute('checked'),'false');
assert.equal(forget.disabled,true,'forget hidden/disabled when there is no site state');
assert.equal(root.find('twpuxp-context-translate-selected').hidden,true);
translate.fire('command');assert.deepEqual(calls,['translate']);
always.fire('command');
assert.equal(prefs.get('autoTranslateEnabled'),true);
assert.deepEqual(prefs.get('autoTranslateSites').split('\n'),['other.example','sub.example.com','example.com']);
assert.equal(prefs.get('neverTranslateSites'),'blocked.example');
assert.deepEqual(calls,['translate','translate'],'setting the rule should translate the untranslated page');
menu.fire('popupshowing',{target:menu});
assert.equal(always.getAttribute('checked'),'true');
state.originals.push({});
menu.fire('popupshowing',{target:menu});
assert.equal(forget.disabled,false);
assert.equal(restore.disabled,false);
forget.fire('command');
assert.equal(prefs.get('autoTranslateSites'),'other.example\nsub.example.com');
assert.equal(prefs.get('neverTranslateSites'),'blocked.example');
assert.deepEqual(calls.slice(-1),['restore']);
menu.fire('popupshowing',{target:menu});
assert.equal(forget.disabled,true);
assert.equal(restore.disabled,true);
// Existing site exclusion is removed by enabling the site rule.
prefs.set('neverTranslateSites','blocked.example\nexample.com');
always.fire('command');
assert.equal(prefs.get('neverTranslateSites'),'blocked.example');
assert.equal(prefs.get('autoTranslateSites').split('\n').includes('example.com'),true);
// Toggle a checked rule off, without altering any other site.
always.fire('command');
assert.equal(prefs.get('autoTranslateSites'),'other.example\nsub.example.com');
// Non-web content must not show page actions, but existing menu remains available.
doc.location.protocol='file:';
menu.fire('popupshowing',{target:menu});
assert.equal(sub.hidden,true);
console.log('PASS b2a3: context menu state, translate, auto-site rule, forget, restoration, preserved other hosts and file restrictions');
