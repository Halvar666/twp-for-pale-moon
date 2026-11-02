'use strict';
// Lightweight dependency-free protocol and collector tests. Not a Pale Moon UI test.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const root = path.join(__dirname, '..', 'uxp','chrome','content');
let requests = [];
class FakeXHR {
  constructor() {this.headers={}; this.status=200;}
  open(method,url) {this.method=method; this.url=url;}
  setRequestHeader(k,v) {this.headers[k]=v;}
  send(body) {
    requests.push({method:this.method, url:this.url, headers:this.headers, body});
    const payload=JSON.parse(body);
    const items=payload[0][0];
    // Mimic indexed translated paragraphs, non-indexed single nodes.
    const returned = items.map(item=>{
      if (item.includes('<a i=0>'))
        return '<pre><a i=0>Ahoj </a><a i=1>světe</a></pre>';
      return '<pre>Přeložený text</pre>';
    });
    this.responseText=JSON.stringify([returned,[]]);
    this.onload();
  }
}
const ctx = vm.createContext({XMLHttpRequest: FakeXHR, Map, Date, JSON, Error, console, setTimeout, clearTimeout});
// Provider protocol fixture: isolate translation responses from a26 privacy
// channel behavior (separately tested in test-a26-privacy.js).
vm.runInContext('var TWPUXPPrivacyXHR = {create:function(method,url){var r=new XMLHttpRequest();r.open(method,url,true);return r;}};',ctx);
vm.runInContext(fs.readFileSync(path.join(root,'googleProvider.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'pageTranslator.js'),'utf8'),ctx);
function element(tag,children=[],attrs={}) {
  let el={nodeType:1,nodeName:tag.toUpperCase(),children,firstChild:null,nextSibling:null,parentNode:null,
    isContentEditable:false,classList:{contains:()=>false},getAttribute:k=>Object.hasOwn(attrs,k)?attrs[k]:null};
  wire(el, children); return el;
}
function wire(parent,children) {
  parent.firstChild=children[0]||null;
  children.forEach((n,i)=>{n.parentNode=parent;n.nextSibling=children[i+1]||null;});
}
function txt(value){return {nodeType:3,nodeName:'#text',nodeValue:value,parentNode:null,nextSibling:null};}
let t1=txt('Hello '),t2=txt('world'),skipped=txt('hidden'),t3=txt('Bye');
let em=element('em',[t2]);
let p1=element('p',[t1,em]),p2=element('p',[t3]),hidden=element('code',[skipped]);
let body=element('body',[p1,hidden,p2]);
let doc={body};
let pieces=ctx.TWPUXPPageTranslator.collect(doc,100);
assert.strictEqual(pieces.length,2,'Should group two inline nodes and split block paragraphs');
assert.deepStrictEqual(Array.from(pieces.map(p=>p.nodes.length)),[2,1]);
assert.strictEqual(pieces[0].originals.join(''),'Hello world');
let log=[]; assert.strictEqual(ctx.TWPUXPPageTranslator.apply(pieces[0],['Ahoj','světe'],log),2);
assert.strictEqual(t1.nodeValue,'Ahoj '); assert.strictEqual(t2.nodeValue,'světe');
assert.strictEqual(log.length,2);
let doc2={createElement:function(tag) {let ob={value:''};Object.defineProperty(ob,'innerHTML',{set(s){this.value=s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}});return ob;}};
let originalPiece={nodes:[t1,t2],originals:['Hello ','world']};
let called=0;
ctx.TWPGoogleProvider.translatePieces([originalPiece],'en','cs',doc2,'testkey',1000,(err,res)=>{
  if(err) throw err;
  assert.deepStrictEqual(Array.from(res[0]),['Ahoj ','světe']);called++;
});
assert.strictEqual(called,1);
assert.strictEqual(requests.length,1);
assert.strictEqual(JSON.parse(requests[0].body)[0][0][0],'<pre><a i=0>Hello </a><a i=1>world</a></pre>');
ctx.TWPGoogleProvider.translatePieces([originalPiece],'en','cs',doc2,'testkey',1000,(err,res)=>{
  if(err) throw err; called++;
});
assert.strictEqual(called,2);
assert.strictEqual(requests.length,1,'Cache must skip repeated requests');
console.log('PASS: TWP paragraph collector, indexed mapping, translation request and memory cache');
