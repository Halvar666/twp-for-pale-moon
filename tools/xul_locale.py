"""Parse XUL resources with their bundled external locale DTD in offline tests.

ElementTree does not resolve chrome:// external DTDs. Only `&...;` entities
actually declared in the provided local file can be expanded; no external
network or DTD loading is performed. The browser uses the real chrome locale.
"""
from pathlib import Path
import re
import xml.etree.ElementTree as ET

DTD_DECL = re.compile(r'<!ENTITY\s+([A-Za-z][\w.\-]*)\s+"([^"<>]*)">')
XUL_ENTITY = re.compile(r'&([A-Za-z][\w.\-]*);')
XML_BUILTINS = {"amp", "lt", "gt", "apos", "quot"}

def parse_localized_xul_text(text, dtd_text):
    if '<!DOCTYPE ' not in text or 'chrome://twpuxp/locale/twp.dtd' not in text:
        raise ValueError('XUL locale DOCTYPE missing')
    declared = dict(DTD_DECL.findall(dtd_text))
    text = re.sub(r'<!DOCTYPE\s+(?:window|overlay)\s+SYSTEM\s+"chrome://twpuxp/locale/twp\.dtd"\s*>', '', text)
    def expand(match):
        name = match.group(1)
        if name in XML_BUILTINS:
            return match.group(0)
        if name not in declared:
            raise ValueError('Undefined XUL locale entity: ' + name)
        return declared[name]
    return ET.fromstring(XUL_ENTITY.sub(expand, text))

def parse_localized_xul(path, locale='en-US'):
    path = Path(path)
    root = path.parents[2] # content -> chrome -> uxp
    dtd = root / 'chrome/locale' / locale / 'twp.dtd'
    return parse_localized_xul_text(path.read_text('utf-8'), dtd.read_text('utf-8'))
