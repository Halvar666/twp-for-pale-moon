#!/usr/bin/env python3
"""a31 stabilization: verify a freshly assembled installable XPI, not just source files."""
import pathlib
import re
import struct
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
xml_ns = {'em': 'http://www.mozilla.org/2004/em-rdf#'}
source_manifest = ET.parse(root / 'uxp/install.rdf')
version = source_manifest.find('.//em:version', xml_ns).text
assert re.fullmatch(r'\d+\.\d+\.\d+(?:a\d+|b\d+|rc\d+)?', version), version
with tempfile.TemporaryDirectory(prefix='twp-a31-package-') as tmp:
    outfile = pathlib.Path(tmp) / 'test-package.xpi'
    subprocess.run([sys.executable, str(root / 'tools/build-uxp.py'), str(outfile)],
                   cwd=root, capture_output=True, text=True, check=True)
    with zipfile.ZipFile(outfile) as z:
        assert z.testzip() is None, 'Corrupt XPI entry'
        names = z.namelist()
        entries = set(names)
        assert len(names) == len(entries), 'Duplicate XPI entry'
        assert 'LICENSE' in entries and 'README.txt' in entries and 'CREDITS.txt' in entries
        for required in ('install.rdf', 'chrome.manifest',
                         'chrome/content/browserOverlay.xul',
                         'chrome/content/browser.js',
                         'chrome/skin/toolbarButton.css',
                         'defaults/preferences/defaults.js'):
            assert required in entries, f'Missing runtime resource: {required}'
        for n in entries:
            assert not n.startswith(('src/', 'tests/', 'artwork/', 'uxp/')), \
                f'Unwanted source/test/artwork in runtime package: {n}'
            assert '/tests/' not in n and '/artwork/' not in n, n
        install = ET.fromstring(z.read('install.rdf'))
        def meta(name):
            el = install.find('.//em:' + name, xml_ns)
            return el.text if el is not None else None
        assert meta('version') == version
        assert meta('name') == 'TWP for Pale Moon'
        assert meta('homepageURL') is None, 'The original upstream repository must not be the port homepage'
        assert meta('id') == 'twp-uxp-prototype@unofficial.local'
        description = meta('description')
        assert 'UXP' in description and 'XUL' not in description, description
        assert 'experimental' not in description.lower(), description
        assert 'Google' in description and 'Bing' in description
        for attr in ('optionsURL', 'iconURL', 'icon64URL'):
            url = meta(attr)
            assert url and url.startswith('chrome://twpuxp/'), (attr, url)
        for file in ('chrome/content/browserOverlay.xul',
                     'chrome/content/options.xul',
                     'chrome/content/selectionResult.xul'):
            ET.fromstring(z.read(file))
        resource_re = re.compile(r'chrome://twpuxp/(content|skin)/([\w.\-/]+)')
        num_references = 0
        for name in sorted(entries):
            if not name.endswith(('.xul', '.js', '.css', '.manifest', '.rdf')):
                continue
            content = z.read(name).decode('utf-8')
            for match in resource_re.finditer(content):
                resource = 'chrome/' + match.group(1) + '/' + match.group(2)
                assert resource in entries, f'{name} references missing {resource}'
                num_references += 1
        manifest = z.read('chrome.manifest').decode('utf-8')
        for host in ('chrome://browser/content/browser.xul',
                     'chrome://global/content/customizeToolbar.xul'):
            assert (f'style {host} chrome://twpuxp/skin/toolbarButton.css') in manifest
        assert 'overlay chrome://browser/content/browser.xul ' \
               'chrome://twpuxp/content/browserOverlay.xul' in manifest
        assert num_references >= 35, num_references
        about = z.read('chrome/content/browserChrome.js').decode('utf-8')
        assert 'Unofficial native UXP port' in about and 'XUL/UXP' not in about
        options = z.read('chrome/content/options.xul').decode('utf-8')
        assert 'Native UXP translation preferences' in options
        # Confirm the artwork really is the requested icon size (IHDR, not just PNG signature).
        for size in (16, 24, 32, 48, 64, 128):
            image = z.read(f'chrome/skin/icon-{size}.png')
            assert image[:8] == b'\x89PNG\r\n\x1a\n'
            assert struct.unpack('>II', image[16:24]) == (size, size)
        assert version.encode('utf-8') in z.read('README.txt'), 'Package README version is stale'
        assert b'FilipePS' in z.read('CREDITS.txt'), 'Missing original author attribution'
print(f'PASS a31: built XPI {version}, metadata/UXP text, {num_references} chrome references, overlays, both toolbar styles and six icon sizes')
