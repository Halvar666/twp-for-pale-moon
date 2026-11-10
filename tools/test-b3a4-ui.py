"""b3a4: XUL registration and localized controls; no duplicated l10n script."""
from pathlib import Path
from xul_locale import parse_localized_xul
import re
root=Path(__file__).resolve().parents[1]
c=root/'uxp/chrome/content'
for file in ('browserOverlay.xul','selectionResult.xul','options.xul'):
 xul=(c/file).read_text('utf-8')
 assert xul.count('content/l10n.js')==1,(file,'duplicate localization script')
 for locale in ('en-US','cs-CZ','de-DE','fr-FR','es-ES','pl-PL','sk-SK','it-IT'):
  parse_localized_xul(c/file,locale)
options=(c/'options.xul').read_text('utf-8')
overlay=(c/'browserOverlay.xul').read_text('utf-8')
for n in (1,2,3):
 assert f'twpuxp-option-favorite{n}' in options
 assert f'twpuxp-popup-favorite{n}' in overlay
 assert f'TWPUXPPopup.chooseFavorite({n})' in overlay
assert options.index('content/favoriteLanguages.js') < options.index('content/settingsBackup.js')
assert overlay.index('content/favoriteLanguages.js') < overlay.index('content/mainPopup.js')
assert 'favoriteTargetLanguages' in (root/'uxp/defaults/preferences/defaults.js').read_text()
assert 'favoriteTargetLanguages' in (c/'settingsBackup.js').read_text()
print('PASS b3a4: 8 locale variants, 3 favorites controls, backup schema, one localization module load per window')
