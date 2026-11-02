/* MPL-2.0. Stabilization 2: request callback contract, cancellation and tab isolation. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const modulePath = path.resolve(__dirname, '../chrome/content/pageController.js');
const source = fs.readFileSync(modulePath, 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function fixture(onRequest) {
  let active;
  const stateMap = new WeakMap();
  const messages = [];
  const applied = [];
  const values = {maxNodes: 0, useTwpParagraphEngine: true,
    translateIframes: false, translatePageAttributes: false,
    translateDynamicContent: false, batchSize: 1,
    concurrentRequests: 2, requestDelayMs: 0, timeoutMs: 4000,
    translationService: 'google', from: 'en', to: 'cs'};
  const globals = {
    Map, WeakMap, Set, Array, Date, Math, Infinity, Error,
    setTimeout, clearTimeout,
    TWPUXPProviders: {has:()=>true, get:()=>({})},
    TWPUXPCache: {
      translatePieces: (...args) => onRequest(args[2], args[8], args[5]),
      translateMany: (...args) => onRequest(args[2], args[8], args[5])
    },
    TWPUXPLanguage: {detect:()=> 'en'},
    TWPUXPPageTranslator: {
      collect:doc => doc.nodes.map(node=>({nodes:[node], originals:[node.nodeValue]})),
      prioritizeVisible:pieces=>pieces,
      apply:(piece, result, originals) => {
        const node=piece.nodes[0];
        if (node.nodeValue !== piece.originals[0]) return 0;
        const translated=result[0];
        originals.push({node, original:node.nodeValue, translated});
        node.nodeValue=translated;
        applied.push(node);
        return 1;
      }
    },
    window:{alert(){throw Error('Unexpected browser alert')}}
  };
  const ctx=vm.createContext(globals);
  vm.runInContext(source,ctx,{filename:'pageController.js'});
  const getState=doc=>{
    if (!stateMap.has(doc)) stateMap.set(doc,{serial:0, originals:[],running:false,
      observer:null,pendingRoots:new Set(),dynamicTimer:null,
      lastWritten:new WeakMap(),source:null,target:null,service:null,autoAttempted:false});
    return stateMap.get(doc);
  };
  const page=ctx.TWPUXPPageController.create({
    getDoc:()=>active,getState, getBool:(k,defaultValue)=>k in values ? values[k] : defaultValue,
    getInt:(k,defaultValue)=>k in values ? values[k] : defaultValue,
    getString:(k,defaultValue)=>k in values ? values[k] : defaultValue,
    setString:(k,v)=>{values[k]=v},status:(doc,message,isError)=>messages.push({doc,message,isError}),
    prefs:{setBoolPref(){}},P:'extensions.twpuxp.'
  });
  function makeDoc(prefix='Original') {
    const body = {nodeType:1,nodeName:'BODY'};
    const nodes=Array.from({length:2},(_,i)=>({nodeType:3,nodeValue:prefix+' '+i,parentNode:body}));
    return {body,nodes,location:{protocol:'https:',hostname:'example.test',port:''}};
  }
  return {page,makeDoc,messages,applied,values,getState,setActive:doc=>{active=doc}};
}
async function waitUntil(predicate,ms=750) {
  const start=Date.now();
  while(!predicate() && Date.now()-start<ms) await sleep(5);
  assert(predicate(), 'Timeout while waiting for a stable scheduler state');
}
(async()=>{
  // A faulty adapter can deliver a duplicate completion; each batch must
  // adjust inFlight and commit its DOM result exactly once.
  {
    const callbacks=[];
    const x=fixture((batch,cb)=>callbacks.push({batch,cb}));
    const doc=x.makeDoc(); x.setActive(doc);
    x.values.concurrentRequests=1;
    x.page.translateCurrentPage('en','cs');
    assert.equal(callbacks.length,1);
    callbacks[0].cb(null,[['Přeloženo 0']]);
    callbacks[0].cb(null,[['Přeloženo 0']]);
    await waitUntil(()=>callbacks.length===2);
    callbacks[1].cb(null,[['Přeloženo 1']]);
    await waitUntil(()=>x.messages.some(m=>m.message.startsWith('Finished:')));
    assert.deepEqual(doc.nodes.map(n=>n.nodeValue),['Přeloženo 0','Přeloženo 1']);
    assert.equal(x.applied.length,2,'Duplicate callback must never double-commit DOM mutations');
    assert.equal(x.getState(doc).originals.length,2);
    assert.equal(x.getState(doc).running,false);
    assert.match(x.messages.at(-1).message,/Finished: 2\/2/);
    x.page.restoreCurrentPage();
    assert.deepEqual(doc.nodes.map(n=>n.nodeValue),['Original 0','Original 1']);
  }
  // If the adapter throws synchronously, do not leave the page locked in
  // "already running" indefinitely; report an error and allow a retry.
  {
    let throwNow=true, called=0;
    const x=fixture((batch,cb)=>{called++; if(throwNow)throw Error('transport bootstrap failure');
      setTimeout(()=>cb(null,batch.map(p=>p.originals.map(()=> 'OK'))),0);});
    const doc=x.makeDoc(); x.setActive(doc);
    assert.doesNotThrow(()=>x.page.translateCurrentPage('en','cs'));
    assert.equal(x.getState(doc).running,false,'Synchronous exception must cancel operation');
    assert(x.messages.some(m=>m.isError && m.message.includes('transport bootstrap failure')));
    throwNow=false;
    x.page.translateCurrentPage('en','cs');
    await waitUntil(()=>!x.getState(doc).running);
    assert.equal(called,3,'Retry must be able to run after the transport failure');
    assert.equal(x.applied.length,2);
  }
  // Cancel while two requests are in flight; late callbacks must not touch
  // DOM. A new tab must keep separate state and be translatable afterwards.
  {
    const pending=[];
    const x=fixture((batch,cb,doc)=>pending.push({cb,doc}));
    const doc1=x.makeDoc('Tab 1'); x.setActive(doc1);
    x.page.translateCurrentPage('en','cs');
    assert.equal(pending.length,2);
    pending[0].cb(null,[['Translated 1']]);
    x.page.cancelCurrentPage();
    pending[1].cb(null,[['Late response']]);
    await sleep(15);
    assert.equal(x.applied.length,1);
    assert.equal(doc1.nodes[1].nodeValue,'Tab 1 1');
    x.page.restoreCurrentPage();
    assert.deepEqual(doc1.nodes.map(n=>n.nodeValue),['Tab 1 0','Tab 1 1']);
    const doc2=x.makeDoc('Tab 2'); x.setActive(doc2);
    x.page.translateCurrentPage('en','cs');
    assert.equal(pending.length,4);
    pending[2].cb(null,[['Second tab 0']]);
    pending[3].cb(null,[['Second tab 1']]);
    await waitUntil(()=>!x.getState(doc2).running);
    assert.deepEqual(doc2.nodes.map(n=>n.nodeValue),['Second tab 0','Second tab 1']);
    assert.deepEqual(doc1.nodes.map(n=>n.nodeValue),['Tab 1 0','Tab 1 1']);
    x.page.restoreCurrentPage();
    assert.deepEqual(doc2.nodes.map(n=>n.nodeValue),['Tab 2 0','Tab 2 1']);
  }
  console.log('PASS a32: duplicate responses, synchronous network failure/retry, cancel/restore and tab isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
