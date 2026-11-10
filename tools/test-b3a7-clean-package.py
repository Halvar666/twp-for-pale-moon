#!/usr/bin/env python3
"""b3a7: reproducible packaging, locale completeness and exact install targets."""
from pathlib import Path
import hashlib
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ('en-US', 'cs-CZ', 'de-DE', 'fr-FR', 'es-ES', 'pl-PL', 'sk-SK', 'it-IT')
EM = '{http://www.mozilla.org/2004/em-rdf#}'
RDF = '{http://www.w3.org/1999/02/22-rdf-syntax-ns#}'
with tempfile.TemporaryDirectory(prefix='twp-b3a7-') as work:
    paths = [Path(work)/'first.xpi', Path(work)/'second.xpi']
    for out in paths:
        subprocess.run([sys.executable, str(ROOT/'tools/build-uxp.py'), str(out)],
                       cwd=ROOT, check=True, capture_output=True, text=True)
    assert paths[0].read_bytes() == paths[1].read_bytes(), 'XPI builds must be byte-identical'
    with zipfile.ZipFile(paths[0]) as xpi:
        assert xpi.testzip() is None
        entries = xpi.namelist()
        assert len(entries) == len(set(entries)), 'Duplicate archive entries'
        assert len(entries) == 63, ('Unexpected change to the runtime payload',len(entries))
        assert all(info.date_time == (2020,1,1,0,0,0) for info in xpi.infolist())
        assert all(not any(p in name.split('/') for p in ('__pycache__','tests','artwork'))
                   and not name.endswith(('.pyc','.swp','.swo','.bak','~')) for name in entries)
        assert all(not name.startswith(('src/', 'upstream/', 'uxp/')) for name in entries)
        for locale in LOCALES:
            for resource in ('twp.dtd','twp.properties'):
                assert f'chrome/locale/{locale}/{resource}' in entries, locale
        xml = ET.fromstring(xpi.read('install.rdf'))
        manifest_desc = xml.find(f'.//{RDF}Description[@about="urn:mozilla:install-manifest"]')
        assert manifest_desc is not None
        assert manifest_desc.find(f'{EM}version').text == '1.0.0b3'
        assert manifest_desc.find(f'{EM}id').text == 'twp-uxp-prototype@unofficial.local'
        apps = manifest_desc.findall(f'{EM}targetApplication/{RDF}Description')
        assert {(a.find(f'{EM}id').text, a.find(f'{EM}minVersion').text, a.find(f'{EM}maxVersion').text)
                for a in apps} == {
                ('{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}','33.0','35.*'),
                ('{ec8030f7-c20a-464f-9b0e-13a3a9e97384}','52.9.0','52.9.*')}, 'Changed app compatibility'
        assert b'1.0.0b3' in xpi.read('README.txt')
        assert b'FilipePS' in xpi.read('CREDITS.txt')
        manifest = xpi.read('chrome.manifest').decode('utf-8')
        for locale in LOCALES:
            assert f'locale twpuxp {locale} chrome/locale/{locale}/' in manifest
    digest=hashlib.sha256(paths[0].read_bytes()).hexdigest()
print('PASS clean release: two byte-identical packages, 63 runtime files, all 8 locales, unchanged install identity; SHA256 '+digest)
