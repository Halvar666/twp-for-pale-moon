/* MPL-2.0. Regression tests for the original-on-hover UXP controller. */
'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../chrome/content/originalHover.js'), 'utf8');
const ctx = vm.createContext({WeakMap, console, setTimeout, clearTimeout});
vm.runInContext(source, ctx, {filename:'originalHover.js'});
const hover = ctx.TWPUXPOriginalHover;

function fakeDoc() {
  const events = new Map();
  const children=[];
  const doc={defaultView:{innerWidth:1024,innerHeight:768},
    addEventListener(type,cb){let list=events.get(type)||[];list.push(cb);events.set(type,list);},
    removeEventListener(type,cb){events.set(type,(events.get(type)||[]).filter(f=>f!==cb));},
    dispatch(type, event){for (const cb of (events.get(type)||[])) cb(event);},
    listenerCount(type){return (events.get(type)||[]).length},
    createElementNS(ns,tag){assert.equal(tag,'div');return createTooltip()},
    body:{appendChild(el){el.parentNode=this;children.push(el);},removeChild(el){children.splice(children.indexOf(el),1);el.parentNode=null;}},
    children};
  return doc;
}
function createTooltip(){return {nodeType:1,style:{display:'none'},textContent:'',offsetWidth:240,offsetHeight:65,
  setAttribute(name,val){this[name]=val;}};}
function mkText(doc, original, translated){
  const node={nodeType:3,ownerDocument:doc,nodeValue:translated,parentNode:null};
  const element={nodeType:1,ownerDocument:doc,childNodes:[node]};
  node.parentNode=element;
  return {node,element,entry:{node,original,translated}};
}
function sleep(n){return new Promise(r=>setTimeout(r,n));}
function move(doc,target){doc.dispatch('mousemove',{target,clientX:120,clientY:100});}

(async function(){
  const doc=fakeDoc(), frame=fakeDoc();
  const a=mkText(doc,'Original paragraph','Přeložený odstavec');
  const b=mkText(frame,'Frame original','Přeložený rámec');
  doc.caretRangeFromPoint=()=>({startContainer:a.node});
  frame.caretRangeFromPoint=()=>({startContainer:b.node});
  const state={originals:[a.entry,b.entry]};
  hover.start(doc,state,[doc,frame],false);
  assert.equal(doc.listenerCount('mousemove'),0,'off by default installs nothing');
  hover.start(doc,state,[doc,frame],true);
  assert.equal(doc.listenerCount('mousemove'),1);
  assert.equal(frame.listenerCount('mousemove'),1);
  move(doc,a.element);
  await sleep(315);
  assert.equal(doc.children.length,1,'original tooltip is created on demand');
  assert.equal(doc.children[0].textContent,'Original paragraph');
  assert.equal(doc.children[0].style.display,'block');
  assert.equal(doc.children[0].role,'tooltip');
  assert.equal(doc.children[0]['data-twpuxp-ignore'],'true');
  // The preview never mutates translated content.
  assert.equal(a.node.nodeValue,'Přeložený odstavec');
  doc.dispatch('scroll',{});
  assert.equal(doc.children[0].style.display,'none');
  move(frame,b.element);
  await sleep(315);
  assert.equal(frame.children[0].textContent,'Frame original','same-origin frame uses same undo log');
  // Dynamically translated additions can be registered without reinstalling.
  const c=mkText(doc,'Dynamic original','Dynamicky přeloženo');
  hover.remember(state,c.entry);
  doc.caretRangeFromPoint=()=>({startContainer:c.node});
  move(doc,c.element);
  await sleep(315);
  assert.equal(doc.children[0].textContent,'Dynamic original');
  c.node.nodeValue='Website-edited text';
  move(doc,c.element);
  assert.equal(doc.children[0].style.display,'none','stale translated entries are ignored');
  hover.stop(state);
  assert.equal(doc.listenerCount('mousemove'),0,'stop removes main listeners');
  assert.equal(frame.listenerCount('mousemove'),0,'stop removes frame listeners');
  assert.equal(doc.children.length,0,'stop removes preview');
  assert.equal(frame.children.length,0,'stop removes frame preview');
  // Repeated enable/disable must never accumulate event listeners.
  for(let i=0;i<4;i++){hover.start(doc,state,[doc],true);hover.stop(state);}
  assert.equal(doc.listenerCount('mousemove'),0);
  const fdoc=fakeDoc(),f=mkText(fdoc,'Original fallback','Translated fallback');
  const other={nodeType:3,nodeValue:'Untranslated',ownerDocument:fdoc};
  f.element.childNodes.push(other); const fs2={originals:[f.entry]};
  hover.start(fdoc,fs2,[fdoc],true);
  move(fdoc,f.element);
  await sleep(315);
  assert.equal(fdoc.children[0].textContent,'Original fallback','fallback on direct text child');
  hover.stop(fs2);
  console.log('PASS a20 original-on-hover: off-by-default, translated nodes, frames, dynamic updates, stale content, cleanup, fallback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
