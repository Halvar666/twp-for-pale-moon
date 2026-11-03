#!/usr/bin/env python3
"""Build UXP/XUL XPI from full TWP source fork, without Node/npm dependencies.

Original upstream files in src/ are never modified or packaged into the XPI.
Only uxp/ is packaged; complete source archive ships upstream src/ + uxp/.
"""
import sys
import hashlib
import pathlib
import xml.etree.ElementTree as ET
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / 'uxp'
NS = {'em': 'http://www.mozilla.org/2004/em-rdf#'}
manifest = ET.parse(SRC / 'install.rdf')
version = manifest.find('.//em:version', NS)
assert version is not None and version.text, 'Missing version in install.rdf'
VERSION = version.text
output = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT.parent / ('TWP-for-Pale-Moon-UXP-' + VERSION + '.xpi')
files = [p for p in SRC.rglob('*') if p.is_file() and not p.name.endswith('~')]
for rel in ('install.rdf', 'chrome.manifest', 'chrome/content/browserOverlay.xul',
            'chrome/content/browser.js','chrome/content/pageController.js','chrome/content/selectionController.js','chrome/content/browserChrome.js','chrome/content/shortcutBindings.js','chrome/content/shortcuts.js','chrome/content/pageTranslator.js',
            'chrome/content/privacyXHR.js','chrome/content/googleProvider.js','chrome/content/bingProvider.js',
            'chrome/content/deeplProvider.js',
            'chrome/content/translationProviders.js','chrome/content/originalHover.js','chrome/content/persistentCache.js','chrome/content/pageAttributes.js','chrome/content/dynamicObserver.js',
            'chrome/content/languageDetector.js','chrome/content/textLayout.js',
            'chrome/content/selectionResult.js','chrome/content/selectionResult.xul',
            'chrome/content/languageMenus.js','chrome/content/languageCatalog.js',
            'chrome/content/autoRules.js','chrome/content/mainPopup.js',
            'chrome/skin/mainPopup.css','chrome/content/options.xul',
            'chrome/content/options.js','chrome/skin/options.css',
            'chrome/skin/selectionResult.css','chrome/skin/toolbarButton.css',
            'chrome/skin/icon-16.png','chrome/skin/icon-24.png','chrome/skin/icon-48.png',
            'defaults/preferences/defaults.js'):
    assert (SRC / rel).is_file(), 'Missing: ' + rel
ET.parse(SRC / 'chrome/content/browserOverlay.xul')
ET.parse(SRC / 'chrome/content/selectionResult.xul')
ET.parse(SRC / 'chrome/content/options.xul')
for icon in SRC.glob('chrome/skin/icon-*.png'):
    assert icon.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'), icon
assert (ROOT / 'src/contentScript/pageTranslator.js').exists(), 'Need full upstream snapshot'
assert (ROOT / 'src/background/translationService.js').exists(), 'Need full upstream snapshot'
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as xpi:
    for f in sorted(files):
        # Do not ship the high-resolution source artwork in the runtime XPI.
        if f.relative_to(SRC).as_posix().startswith(('artwork/', 'tests/')):
            continue
        xpi.write(f,f.relative_to(SRC).as_posix())
    xpi.write(ROOT / 'LICENSE','LICENSE')
    xpi.write(ROOT / 'CREDITS-UXP.md','CREDITS.txt')
    xpi.write(ROOT / 'UXP-PORT-README.md','README.txt')
with zipfile.ZipFile(output) as xpi:
    assert xpi.testzip() is None
print(str(output))
print('SHA256',hashlib.sha256(output.read_bytes()).hexdigest())
print('Original TWP upstream unmodified:',ROOT/'src')
