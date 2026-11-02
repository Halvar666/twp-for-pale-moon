/* MPL-2.0. Standalone regression test for fixed XUL popup sizing and placement. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..', 'uxp');
const xul = fs.readFileSync(path.join(root, 'chrome/content/browserOverlay.xul'), 'utf8');
const css = fs.readFileSync(path.join(root, 'chrome/skin/mainPopup.css'), 'utf8');
function ok(value, message) { if (!value) throw new Error(message); }
ok(/<panel id="twpuxp-popup-main"[^>]*width="400"/.test(xul), 'Missing fixed width on XUL panel');
ok(/<vbox id="twpuxp-popup-body" width="400"/.test(xul), 'Missing fixed body width');
for (const id of ['always', 'never', 'language', 'neverlanguage', 'hover']) {
  ok(new RegExp('<checkbox id="twpuxp-popup-'+id+'" crop="end"').test(xul), 'Missing crop on '+id);
}
ok(/#twpuxp-popup-main\s*\{[^}]*width:\s*400px;[^}]*min-width:\s*400px;[^}]*max-width:\s*400px;/s.test(css),'Panel is not fixed width');
ok(/#twpuxp-popup-body\s*\{[^}]*width:\s*400px;[^}]*min-width:\s*400px;[^}]*max-width:\s*400px;/s.test(css),'Body is not fixed width');
class Node {
  constructor(id='') {this.id=id;this.attrs={};this.children=[];this.disabled=false;this.checked=false;this.state='closed';}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]||'';}
  appendChild(el){this.children.push(el);}
  removeChild(el){this.children.splice(this.children.indexOf(el),1);}
  getElementsByTagName(tag){return this.children.filter(e=>e.tag===tag);}
  hidePopup(){this.state='closed';}
  openPopup(anchor, position){this.state='open';this.position=position;}
}
const ids=['main','state','notice','site','original','cancel','translate','selection','always','never','language','neverlanguage','service','from','to'];
const nodes={};ids.forEach(id=>nodes['twpuxp-popup-'+id]=new Node(id));
const menu=nodes['twpuxp-popup-service'];
menu.getElementsByTagName=()=>[{getAttribute:(k)=>'google'}];
const values={translationService:'google',from:'auto',to:'cs',autoTranslateLanguages:'',neverTranslateLanguages:'',autoTranslateSites:'',neverTranslateSites:''};
const pref={getCharPref:k=>values[k.replace('extensions.twpuxp.','')]||'', getBoolPref:()=>false,setCharPref:(k,v)=>values[k.replace('extensions.twpuxp.','')]=v, setBoolPref:()=>{}};
const page={supported:true,host:'edition.cnn.com',detected:'en',document:{},translated:false,running:false};
const context={window:{innerWidth:700},document:{getElementById:id=>nodes[id]||null},
  Components:{classes:{'@mozilla.org/preferences-service;1':{getService:()=>pref}},interfaces:{nsIPrefBranch:{}}},
  TWPUXP:{getPageInfo:()=>page}, TWPUXPProviders:{has:()=>true},
  TWPUXPLanguageMenus:{populate:()=>{},choose:()=>{},value:()=>''},
  TWPUXPLanguageCatalog:{has:()=>true,list:()=>[['en','English'],['cs','Czech']]},
  TWPUXPAutoRules:{parseHosts:()=>[]},console};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'chrome/content/mainPopup.js'),'utf8'),context);
const popup=context.TWPUXPPopup;
const left={getBoundingClientRect:()=>({left:40,right:65})};
const right={getBoundingClientRect:()=>({left:665,right:690})};
ok(popup.open(left)===true,'Cannot open left popup');
ok(nodes['twpuxp-popup-main'].position==='after_start','Left button must left-align popup');
const before=nodes['twpuxp-popup-neverlanguage'].getAttribute('label');
ok(before==='Never auto-translate: English','Unexpected verbose label: '+before);
nodes['twpuxp-popup-neverlanguage'].checked=true;
popup.refresh();
ok(nodes['twpuxp-popup-neverlanguage'].getAttribute('label')===before,'Toggling a checkbox must not change its label width');
ok(nodes['twpuxp-popup-neverlanguage'].getAttribute('tooltiptext').includes('English'),'Full name missing in tooltip');
popup.open(left); // closes
ok(popup.open(right)===true,'Cannot open right popup');
ok(nodes['twpuxp-popup-main'].position==='after_end','Right button must right-align popup');
console.log('PASS a25: fixed popup width, cropped dynamic controls, stable labels, correct edge alignment');
