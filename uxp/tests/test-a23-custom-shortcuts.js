/* MPL-2.0: configurable XUL shortcuts model, native keyset updates and UI capture */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,'chrome/content',n),'utf8');
const modelSource=read('shortcutBindings.js');
const shortcutsSource=read('shortcuts.js');
const optionsSource=read('options.js');
const xul=read('options.xul');
const defaults=fs.readFileSync(path.join(root,'defaults/preferences/defaults.js'),'utf8');
for (const a of ['toggle','selection','restore']) {
  assert.match(xul,new RegExp('id="twpuxp-shortcut-input-'+a+'"'));
  assert.match(xul,new RegExp("captureShortcut\\(event, '&".replace('&',a))); // begins correct handler
}
assert.match(defaults,/shortcutToggle", "control,alt\|T"/);
assert.match(defaults,/shortcutSelection", "control,alt\|S"/);
assert.match(defaults,/shortcutRestore", "alt,shift\|VK_0"/);
const bc=vm.createContext({});vm.runInContext(modelSource,bc,{filename:'shortcutBindings.js'});
const B=bc.TWPUXPShortcutBindings;
assert.equal(B.canonical('shift,alt|VK_0'),'alt,shift|VK_0');
assert.equal(B.canonical('CONTROL,ALT|y'),'control,alt|Y');
assert.equal(B.canonical(''),'');
assert.equal(B.label('control,alt|Y'),'Ctrl+Alt+Y');
assert.equal(B.label(''),'Disabled');
assert.deepEqual(JSON.parse(JSON.stringify(B.unpack('shift,alt|VK_0'))),{modifiers:'alt,shift',key:'',keycode:'VK_0'});
assert.equal(B.fromEvent({keyCode:89,ctrlKey:true,altKey:true}), 'control,alt|Y');
assert.equal(B.fromEvent({keyCode:48,altKey:true,shiftKey:true}), 'alt,shift|VK_0');
assert.equal(B.fromEvent({keyCode:113,ctrlKey:true}), 'control|VK_F2');
assert.equal(B.fromEvent({keyCode:89,shiftKey:true}), null, 'unmodified Shift+letter rejected');
assert.throws(()=>B.canonical('ctrl|Y'),/Invalid modifier/);
assert.throws(()=>B.canonical('shift|Y'),/Ctrl, Alt or Meta/);
assert.throws(()=>B.canonical('control,control|Y'),/Invalid modifier/);
assert.throws(()=>B.validateSet({toggle:'control,alt|Y',selection:'alt,control|Y',restore:''}),/Duplicate/);
assert.equal(B.validateSet({toggle:'',selection:'',restore:''}).restore,'');

function makeKey(id,attrs,owner) {
  let node={id, attrs:{...attrs}, parentNode:null,
    getAttribute(n){return this.attrs[n]||'';},
    setAttribute(n,v){this.attrs[n]=String(v)},
    removeAttribute(n){delete this.attrs[n]},
    cloneNode(){return makeKey(this.id,this.attrs,owner);}};
  return node;
}
const ids={toggle:'twpuxp-shortcut-toggle', selection:'twpuxp-shortcut-selection',restore:'twpuxp-shortcut-restore'};
const nodes={};
for(const a of Object.keys(ids)) {
  const aKey= a==='restore'?{keycode:'VK_0',modifiers:'shift,alt'}:{key:a==='toggle'?'T':'S',modifiers:'control,alt'};
  nodes[ids[a]]=makeKey(ids[a],{...aKey,oncommand:`TWPUXPShortcuts.run('${a}')`});
}
let refreshes=0, notified=[];
const mainParent={appendChild(n){assert.equal(n,main);refreshes++;n.parentNode=this;}};
const main={id:'mainKeyset',children:[],parentNode:mainParent,
  appendChild(k){k.parentNode=this; if(!this.children.includes(k))this.children.push(k);nodes[k.id]=k;},
  replaceChild(k,old){const pos=this.children.indexOf(old);assert(pos>=0);this.children[pos]=k;k.parentNode=this;old.parentNode=null;nodes[k.id]=k;}};
const preferences={
  'extensions.twpuxp.keyboardShortcutsEnabled':true,
  'extensions.twpuxp.shortcutToggle':'control,alt|T',
  'extensions.twpuxp.shortcutSelection':'control,alt|S',
  'extensions.twpuxp.shortcutRestore':'alt,shift|VK_0'
};
const observers=[];
const prefBranch={
 getBoolPref(n){if(!(n in preferences))throw Error(n);return preferences[n];},
 getCharPref(n){if(!(n in preferences))throw Error(n);return preferences[n];},
 setCharPref(n,v){preferences[n]=v;this.emit(n);},
 setBoolPref(n,v){preferences[n]=v;this.emit(n);},
 setIntPref(n,v){preferences[n]=v;this.emit(n);},
 addObserver(prefix,obj){observers.push({prefix,obj});},
 removeObserver(prefix,obj){const i=observers.findIndex(r=>r.prefix===prefix&&r.obj===obj);assert(i>=0);observers.splice(i,1);},
 emit(n){for(const {prefix,obj} of [...observers])if(n.startsWith(prefix))obj.observe(null,'nsPref:changed',n);}
};
const events={},calls=[];
let info={supported:true,running:false,translated:false};
const context=vm.createContext({document:{getElementById(id){return id==='mainKeyset'?main:nodes[id]||null;}},
  window:{addEventListener(type,fn){events[type]=fn;}},
  Components:{classes:{'@mozilla.org/preferences-service;1':{getService(){return prefBranch;}}},
              interfaces:{nsIPrefBranch:{},nsIPrefBranch2:{}}},
  TWPUXP:{getPageInfo(){return info;},translateCurrentPage(){calls.push('translate');},
    restoreCurrentPage(){calls.push('restore');},cancelCurrentPage(){calls.push('cancel');},
    translateSelectedText(){calls.push('selection');}}});
vm.runInContext(modelSource,context);vm.runInContext(shortcutsSource,context);
events.load();assert.equal(main.children.length,3);assert.equal(observers.length,1);
assert.equal(nodes[ids.toggle].getAttribute('key'),'T');
assert.equal(context.TWPUXPShortcuts.run('toggle'),true);assert.equal(calls.at(-1),'translate');
info={supported:true,running:true,translated:false};context.TWPUXPShortcuts.run('toggle');assert.equal(calls.at(-1),'cancel');
info={supported:true,running:false,translated:true};context.TWPUXPShortcuts.run('toggle');assert.equal(calls.at(-1),'restore');
context.TWPUXPShortcuts.run('selection');assert.equal(calls.at(-1),'selection');
const oldToggle=nodes[ids.toggle];const prevRefreshes=refreshes;
prefBranch.setCharPref('extensions.twpuxp.shortcutToggle','control,alt|Y');
assert.notEqual(nodes[ids.toggle],oldToggle,'hotkey node must be rebuilt');
assert.equal(nodes[ids.toggle].getAttribute('key'),'Y');
assert.equal(nodes[ids.toggle].getAttribute('oncommand'),"TWPUXPShortcuts.run('toggle')");
assert(refreshes>prevRefreshes,'mainKeyset re-attached to refresh platform handlers');
prefBranch.setCharPref('extensions.twpuxp.shortcutRestore','');
assert.equal(nodes[ids.restore].getAttribute('keycode'),'');
assert.equal(nodes[ids.restore].getAttribute('disabled'),'true');
const count=calls.length;assert.equal(context.TWPUXPShortcuts.run('restore'),false);assert.equal(calls.length,count);
prefBranch.setBoolPref('extensions.twpuxp.keyboardShortcutsEnabled',false);
assert.equal(nodes[ids.toggle].getAttribute('key'),'');
assert.equal(nodes[ids.selection].getAttribute('disabled'),'true');
prefBranch.setBoolPref('extensions.twpuxp.keyboardShortcutsEnabled',true);
assert.equal(nodes[ids.toggle].getAttribute('key'),'Y');
assert.equal(nodes[ids.selection].getAttribute('key'),'S');
assert.equal(nodes[ids.restore].getAttribute('disabled'),'true','individual disable persists');
events.unload();assert.equal(observers.length,0);

// Option window: capture, duplicate prevention, escape cancel, clear, reset and save.
const elements={};
for(const action of B.actions)elements['twpuxp-shortcut-input-'+action]={value:''};
const errorEl={textContent:'',value:''};elements['twpuxp-shortcut-error']=errorEl;
const err={textContent:''};elements['twpuxp-options-error']=err;
for (const id of ['from','to','service','autoenabled','autosites','neversites','autolangs','neverlangs',
  'diskcache','privacy','dynamic','attributes','iframes','grouped','hover','shortcuts','concurrency','batch','maxnodes','cachecount'])
 elements['twpuxp-option-'+id]={value:'',checked:true,selectedItem:null,getElementsByTagName(){return [{getAttribute(){return 'google'}}];}};
elements['twpuxp-option-service'].selectedItem={getAttribute(){return 'google'}};
elements['twpuxp-option-concurrency'].value='3';
elements['twpuxp-option-batch'].value='8';
elements['twpuxp-option-maxnodes'].value='0';
let closeCount=0,syncCount=0;
const optCtx=vm.createContext({
 TWPUXPShortcutBindings:B,
 document:{getElementById(id){return elements[id]||null;}},
 window:{close(){closeCount++},opener:{TWPUXPShortcuts:{sync(){syncCount++}}}},
 Components:{classes:{'@mozilla.org/preferences-service;1':{getService(){return prefBranch;}}},interfaces:{nsIPrefBranch:{}}},
 TWPUXPLanguageMenus:{value(el){return el===elements['twpuxp-option-from']?'auto':el===elements['twpuxp-option-to']?'cs':'google'},
 populate(){},choose(){},has(){return true}},
 TWPUXPAutoRules:{parseHosts(){return []},parseLanguages(){return []}},
 TWPUXPCache:{count(){return 1}}
});
vm.runInContext(optionsSource,optCtx);
const O=optCtx.TWPOptions;O.init();
assert.equal(elements['twpuxp-shortcut-input-toggle'].value,'Ctrl+Alt+Y');
function keyEvent(keyCode,extra={}){
 let stopped=false,prevented=false;
 return {keyCode,...extra,preventDefault(){prevented=true;},stopPropagation(){stopped=true;},
         get swallowed(){return stopped&&prevented;}};
}
let ev=keyEvent(85,{ctrlKey:true,altKey:true});O.captureShortcut(ev,'toggle');
assert.equal(elements['twpuxp-shortcut-input-toggle'].value,'Ctrl+Alt+U');assert(ev.swallowed);
ev=keyEvent(85,{altKey:true,ctrlKey:true});O.captureShortcut(ev,'selection');
assert.match(errorEl.textContent,/Duplicate shortcut/);
assert.equal(elements['twpuxp-shortcut-input-selection'].value,'Ctrl+Alt+S');
O.captureShortcut(keyEvent(27),'toggle');assert.equal(elements['twpuxp-shortcut-input-toggle'].value,'Ctrl+Alt+U');
O.clearShortcut('restore');assert.equal(elements['twpuxp-shortcut-input-restore'].value,'Disabled');
O.resetShortcut('restore');assert.equal(elements['twpuxp-shortcut-input-restore'].value,'Alt+Shift+0');
O.clearShortcut('restore');O.save();
assert.equal(closeCount,1);assert.equal(preferences['extensions.twpuxp.shortcutToggle'],'control,alt|U');
assert.equal(preferences['extensions.twpuxp.shortcutRestore'],'');
assert(syncCount>=1);
console.log('PASS a23: shortcut capture/validation/disable/reset, pref persistence, key replacement and keyset refresh');
