/* MPL-2.0: toolbar placement regression: Australis and classic UXP paths. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const source=fs.readFileSync(path.join(__dirname, '../chrome/content/browserChrome.js'),'utf8');
const ID='twpuxp-page-button', PREFIX='extensions.twpuxp.';
class Element {
  constructor(name,id='') {
    this.localName=name; this.nodeName=name.toUpperCase(); this.id=id;
    this.children=[];this.parentNode=null;this.attrs={};this.handlers={};
  }
  appendChild(n){if(n.parentNode){const i=n.parentNode.children.indexOf(n);if(i!==-1)n.parentNode.children.splice(i,1);}this.children.push(n);n.parentNode=this;return n;}
  getAttribute(k){return this.attrs[k]||'';}
  setAttribute(k,v){this.attrs[k]=String(v);}
  addEventListener(name,cb){this.handlers[name]=cb;}
  getElementsByTagName(tag){return this.children.flatMap(c=>((c.localName===tag)?[c]:[]).concat(c.getElementsByTagName(tag)));}
  find(id){if(this.id===id)return this;for(const child of this.children){const result=child.find(id);if(result)return result;}return null;}
}
function runCase(opt) {
  const root=new Element('window','root');
  const popupset=root.appendChild(new Element('popupset','mainPopupSet'));
  const contextMenu=root.appendChild(new Element('menupopup','contentAreaContextMenu'));
  const palette=root.appendChild(new Element('toolbarpalette','BrowserToolbarPalette'));
  const toolbar=root.appendChild(new Element('toolbar','nav-bar'));
  const button=new Element('toolbarbutton',ID);
  const target=opt.australis ? toolbar.appendChild(new Element('hbox','nav-bar-customization-target')):toolbar;
  if (opt.australis) toolbar.setAttribute('customizationtarget','nav-bar-customization-target');
  let insertCount=0,persistCount=0,addCount=0,importCount=0;
  let placement = opt.placement || null;
  palette.appendChild(button);
  if (opt.placement && opt.placement.area==='nav-bar') target.appendChild(button);
  if (opt.placement && opt.placement.area==='other-toolbar') root.appendChild(button);
  toolbar.insertItem=function(id){insertCount++;assert.equal(id,ID);target.appendChild(button);};
  const prefs=new Map([['toolbarInserted',!!opt.pref],['unlimitedNodesMigrationA4',true],['translationService','google']]);
  const prefApi={getBoolPref(n){return !!prefs.get(n.slice(PREFIX.length));},setBoolPref(n,v){prefs.set(n.slice(PREFIX.length),v);}};
  const cui={AREA_NAVBAR:'nav-bar',getPlacementOfWidget(id){assert.equal(id,ID);return placement;},
    addWidgetToArea(id,area){addCount++;assert.equal(id,ID);assert.equal(area,'nav-bar');placement={area,position:0};target.appendChild(button);}};
  const listeners={};
  const doc={location:{protocol:'https:',hostname:'example.com'},body:{},documentElement:{}};
  const context={P:PREFIX,prefs:prefApi,getDoc(){return doc;},getState(){return {running:false,originals:[]};},getBool(k,d){return prefs.has(k)?prefs.get(k):d;},getInt(){return 0;},getString(k,d){return prefs.has(k)?prefs.get(k):d;},setString(k,v){prefs.set(k,v);},status(){},states:new WeakMap()};
  const page={translateCurrentPage(){},restoreCurrentPage(){},cancelCurrentPage(){},startDynamic(){},stopDynamic(){},toggleEngine(){}};
  const selection={getSelectionInfo(){return null;},translateSelectedText(){}};
  const contextObj=vm.createContext({
    window:{addEventListener(n,cb){listeners[n]=cb;},removeEventListener(){},alert(){}},
    document:{documentElement:root,getElementById(id){return root.find(id);},getElementsByTagName(tag){return root.getElementsByTagName(tag);},createElement(name){return new Element(name);},persist(id,attr){persistCount++;assert.equal(id,'nav-bar');assert.equal(attr,'currentset');}},
    Components:{utils:{import(uri,target){importCount++;assert.equal(uri,'resource:///modules/CustomizableUI.jsm');if(opt.importError)throw Error('import failed');target.CustomizableUI=cui;}}},
    gBrowser:{addEventListener(){},tabContainer:{addEventListener(){}}},
    setTimeout(){},console
  });
  vm.runInContext(source,contextObj);
  contextObj.TWPUXPBrowserChrome.create(context,page,selection);
  assert.equal(typeof listeners.load,'function');
  listeners.load();
  return {insertCount,persistCount,addCount,importCount,placement,button,parent:button.parentNode,toolbar,target,prefs};
}
// Classic Pale Moon, first install: calls legacy insertItem/currentset exactly once.
let r=runCase({australis:false,pref:false});
assert.equal(r.insertCount,1);assert.equal(r.persistCount,1);assert.equal(r.importCount,0);
assert.equal(r.button.parentNode,r.toolbar);assert.equal(r.prefs.get('toolbarInserted'),true);
// Classic Pale Moon, already placed: avoid reinsertion but recognize location.
r=runCase({australis:false,pref:false,placement:{area:'nav-bar',position:4}});
assert.equal(r.insertCount,0);assert.equal(r.persistCount,0);assert.equal(r.prefs.get('toolbarInserted'),true);
// Australis: user placed widget in navigation bar (possibly at arbitrary position): never move.
r=runCase({australis:true,pref:false,placement:{area:'nav-bar',position:2}});
assert.equal(r.insertCount,0);assert.equal(r.addCount,0);assert.equal(r.persistCount,0);
assert.equal(r.prefs.get('toolbarInserted'),true);assert.equal(r.button.parentNode,r.target);
// Australis: user moved widget to different toolbar/panel/overflow: respect CUI placement.
for(const area of ['other-toolbar','widget-overflow','PanelUI-contents']) {
  r=runCase({australis:true,pref:false,placement:{area,position:3}});
  assert.equal(r.insertCount,0);assert.equal(r.addCount,0);assert.equal(r.persistCount,0);
  assert.equal(r.prefs.get('toolbarInserted'),true);
}
// Australis: first installation with no known placement uses only CUI (never legacy persistence).
r=runCase({australis:true,pref:false});
assert.equal(r.insertCount,0);assert.equal(r.persistCount,0);assert.equal(r.addCount,1);
assert.equal(r.prefs.get('toolbarInserted'),true);assert.equal(r.placement.area,'nav-bar');
// Australis: widget intentionally removed after previous install: existing pref stops reinsertion.
r=runCase({australis:true,pref:true});
assert.equal(r.insertCount,0);assert.equal(r.addCount,0);assert.equal(r.persistCount,0);
// Australis with unavailable CustomizableUI must NOT fall back to classic insertItem.
r=runCase({australis:true,pref:false,importError:true});
assert.equal(r.importCount,1);assert.equal(r.insertCount,0);assert.equal(r.addCount,0);
assert.equal(r.prefs.get('toolbarInserted'),false);
console.log('PASS b2a4: preserved Pale Moon insert/currentset, Australis position in all areas, initial placement, removed widget and safe import failure');
