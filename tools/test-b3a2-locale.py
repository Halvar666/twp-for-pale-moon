"""b3a2: both bundled locale variants and native XUL entity references."""
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
from xul_locale import parse_localized_xul
r=Path(__file__).resolve().parents[1]
u=r/'uxp'
dtd=[]
props=[]
for locale in ('en-US','cs-CZ'):
    d=(u/'chrome/locale'/locale/'twp.dtd').read_text('utf-8')
    p=(u/'chrome/locale'/locale/'twp.properties').read_text('ascii')
    dk=set(re.findall(r'<!ENTITY\s+([\w.]+)\s+"',d))
    pk=set(re.findall(r'^([\w.]+)=',p,flags=re.M))
    assert len(dk)==110, (locale,len(dk))
    assert len(pk)>=80,(locale,len(pk))
    dtd.append(dk);props.append(pk)
    for f in ('options.xul','browserOverlay.xul','selectionResult.xul'):
        path=u/'chrome/content'/f
        dom=parse_localized_xul(path,locale)
        assert dom is not None
        raw=path.read_text('utf-8')
        assert set(re.findall(r'&([\w.]+);',raw)) <= dk | {'amp','lt','gt','quot','apos'}
    opts=parse_localized_xul(u/'chrome/content/options.xul',locale)
    assert opts.find('.//{*}button[@id="twpuxp-option-save"]') is not None
assert dtd[0]==dtd[1] and props[0]==props[1]
for resource in ('locale twpuxp en-US','locale twpuxp cs ','locale twpuxp cs-CZ'):
    assert resource in (u/'chrome.manifest').read_text('utf-8')
rdf=ET.parse(u/'install.rdf')
assert rdf.find('.//{http://www.mozilla.org/2004/em-rdf#}version').text=='1.0.0b3'
print('PASS b3a2: 110 static entities, %d dynamic keys, two locale catalogs, three XUL dialogs'%len(props[0]))
