"""b3a5 dictionary integration: localized XUL, backup semantics, source wiring."""
from pathlib import Path
from xul_locale import parse_localized_xul
root=Path(__file__).resolve().parents[1]
c=root/'uxp/chrome/content'
for locale in ('en-US','cs-CZ','de-DE','fr-FR','es-ES','pl-PL','sk-SK','it-IT'):
    dtd=(root/'uxp/chrome/locale'/locale/'twp.dtd').read_text('utf-8')
    for i in (68,69,70):
        assert f'<!ENTITY options.{i:03d}' in dtd,locale
    parse_localized_xul(c/'options.xul',locale)
assert 'twpuxp-option-dictionary' in (c/'options.xul').read_text()
assert 'TWPUXPCustomDictionary.encode' in (c/'options.js').read_text()
assert 'TWPUXPCustomDictionary.decode' in (c/'settingsBackup.js').read_text()
assert 'dictionary:TWPUXPCustomDictionary' in (c/'options.js').read_text()
overlay=(c/'browserOverlay.xul').read_text()
assert overlay.index('content/customDictionary.js') < overlay.index('content/pageController.js')
assert 'customDictionary' in (root/'uxp/defaults/preferences/defaults.js').read_text()
print('PASS b3a5: localized dictionary UI (8), source wiring and backup schema')
