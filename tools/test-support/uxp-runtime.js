/* MPL-2.0: shared mock test runtime for the browser-era integration fixtures.
 * Loads the REAL persistent-cache module with disabled preference in legacy
 * integration mocks. This retains the current runtime call signatures without
 * opening SQLite, accessing private browsing, or rewriting production code.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function loadLegacyCache(ctx, contentDir) {
  const file = path.join(contentDir, 'persistentCache.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, {filename:'persistentCache.js'});
  if (!ctx.TWPUXPCache || typeof ctx.TWPUXPCache.translatePieces !== 'function' ||
      typeof ctx.TWPUXPCache.translateMany !== 'function')
    throw new Error('Real cache module not initialized in test context');
}
function loadSharedOptionModules(ctx, contentDir) {
  for(const name of ['shortcutBindings.js', 'persistentCache.js']) {
    vm.runInContext(fs.readFileSync(path.join(contentDir,name),'utf8'),ctx,{filename:name});
  }
}
module.exports = {loadLegacyCache,loadSharedOptionModules};
