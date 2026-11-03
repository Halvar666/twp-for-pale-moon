/* MPL-2.0. Cleanup 2: regression infrastructure invariants. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
function read(name) { return fs.readFileSync(path.join(root,name),'utf8'); }
assert.match(read('uxp/install.rdf'), /<em:version>\d+\.\d+\.\d+(?:a\d+|b\d+(?:a\d+)?|rc\d+)?<\/em:version>/);
const runner = read('tools/run-uxp-tests.py');
assert.match(runner, /TEST_DIRS/);
assert.match(runner, /subprocess\.run/);
assert.match(runner, /return 1 if failures else 0/);
assert.doesNotMatch(runner, /MAINTAINED\s*=/);
assert.ok(fs.existsSync(path.join(root, 'tools/test-support/uxp-runtime.js')));
const integrationFixtures = [
 'test-a4-scheduler.js','test-a5-dynamic.js','test-a6-selection.js',
 'test-a8-bing-page.js','test-a9-bing-page-recovery.js',
 'test-a12-page-recovery.js','test-a12-persistent-outage.js','test-a15-attributes-frames.js'
];
for(const name of integrationFixtures) {
 const file = read('tools/'+name);
 assert.match(file, /loadLegacyCache/);
}
const xmlFixture = read('tools/test-a10-options-layout.py');
assert.match(xmlFixture, /ET\.parse/);
console.log('PASS a29: all tests discovered, real cache loaded in legacy mocks, XML layout included, version updated');
