#!/usr/bin/env python3
import pathlib
import xml.etree.ElementTree as ET
from xul_locale import parse_localized_xul
root = pathlib.Path(__file__).resolve().parents[1]
ns = {'x': 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'}
tree = ET.ElementTree(parse_localized_xul(root / 'uxp/chrome/content/options.xul'))
w = tree.getroot()
assert int(w.attrib['height']) >= 630
scroll=w.find('.//x:scrollbox',ns)
assert scroll is not None and scroll.attrib.get('flex')=='1'
footer=w.find('.//x:hbox[@class="twpuxp-options-footer"]',ns)
assert footer is not None
save=footer.find('.//x:button[@id="twpuxp-option-save"]',ns)
assert save is not None
buttons=footer.findall('.//x:button',ns)
assert len(buttons)==2
assert save not in list(scroll.iter())
assert all(node in list(scroll.iter()) for node in w.findall('.//x:groupbox',ns))
assert w.find('.//x:spacer',ns) is None
print('PASS: options dialog has a scrollable field area and fixed footer buttons')
