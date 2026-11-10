"""b3a3: locale coverage, placeholders, XUL expansion and chrome registrations."""
from pathlib import Path
import html
import re
from xul_locale import parse_localized_xul

ROOT = Path(__file__).resolve().parents[1]
UXP = ROOT / 'uxp'
LOCALES = ('en-US','cs-CZ','de-DE','fr-FR','es-ES','pl-PL','sk-SK','it-IT')


def dtd_keys(locale):
    raw = (UXP/'chrome/locale'/locale/'twp.dtd').read_text('utf-8')
    entries = re.findall(r'^<!ENTITY\s+([\w.]+)\s+"([^"<>]*)">$',raw,re.M)
    result = {k:html.unescape(v) for k,v in entries}
    assert len(entries) == len(result) == 110, (locale,'dtd',len(entries))
    return result


def prop_keys(locale):
    raw = (UXP/'chrome/locale'/locale/'twp.properties').read_text('ascii')
    entries = [l.split('=',1) for l in raw.splitlines() if l and not l.startswith('#')]
    result = dict(entries)
    assert len(entries)==len(result)==109, (locale,'properties',len(entries))
    return result


def placeholders(x):
    return sorted(re.findall(r'\{\d+\}',x))

english_dtd=dtd_keys('en-US')
english_props=prop_keys('en-US')
registry=(UXP/'chrome.manifest').read_text('utf-8')
for locale in LOCALES:
    dtd=dtd_keys(locale); props=prop_keys(locale)
    assert dtd.keys()==english_dtd.keys(),(locale,'static key mismatch')
    assert props.keys()==english_props.keys(),(locale,'dynamic key mismatch')
    assert 'locale twpuxp '+locale+' chrome/locale/'+locale+'/' in registry
    for key in english_dtd:
        assert placeholders(dtd[key])==placeholders(english_dtd[key]),(locale,key)
    for key in english_props:
        assert placeholders(props[key])==placeholders(english_props[key]),(locale,key)
        assert props[key].count(r'\n')==english_props[key].count(r'\n'),(locale,key,'newlines')
    for filename in ('options.xul','browserOverlay.xul','selectionResult.xul'):
        xul=UXP/'chrome/content'/filename
        node=parse_localized_xul(xul,locale)
        assert node is not None
    if locale not in ('en-US','cs-CZ'):
        code=locale.split('-')[0]
        assert 'locale twpuxp '+code+' chrome/locale/'+locale+'/' in registry
        for k in ('options.035','options.032','options.030','browser.004','selection.015'):
            assert dtd[k]!=english_dtd[k],(locale,k,'untranslated interface key')
        for k in ('options.exportDone','page.deeplLimit','popup.siteSaved','selection.copied'):
            assert props[k]!=english_props[k],(locale,k,'untranslated status key')

print('PASS b3a3: 8 locales, 110 DTD + 109 properties each, 24 localized XUL parses')
