"""b3a1: XUL controls, runtime dependencies, old-theme layout and manifest targets."""
import pathlib
import xml.etree.ElementTree as ET
from xul_locale import parse_localized_xul
import re
root = pathlib.Path(__file__).resolve().parents[1]
ns = {"x": "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
      "em": "http://www.mozilla.org/2004/em-rdf#"}
xml = ET.ElementTree(parse_localized_xul(root / "uxp/chrome/content/options.xul"))
window = xml.getroot()
assert window.find(".//x:script[@src='chrome://twpuxp/content/settingsBackup.js']", ns) is not None
service = window.find(".//x:menulist[@id='twpuxp-option-service']", ns)
assert service is not None
row = window.find(".//x:hbox[@id='twpuxp-service-row']", ns)
assert row is not None and service in list(row), "Service list must flex horizontally"
assert row.attrib.get("flex") is None, "Do not stretch the row vertically"
for element in ("twpuxp-option-backupkey", "twpuxp-option-export", "twpuxp-option-import", "twpuxp-option-backupstatus"):
    assert window.find(f".//*[@id='{element}']") is not None, element
xul = (root / "uxp/chrome/content/options.xul").read_text()
js = (root / "uxp/chrome/content/options.js").read_text()
assert xul.index("content/settingsBackup.js") < xul.index("content/options.js")
assert 'TWPOptions.exportSettings();' in xul and 'TWPOptions.importSettings();' in xul
assert 'TWPUXPSettingsBackup.decode(' in js and 'TWPUXPSettingsBackup.restore(' in js
rdf = ET.parse(root / "uxp/install.rdf")
assert rdf.find('.//em:version', ns).text == '1.0.0b3'
ids = [x.text for x in rdf.findall('.//em:targetApplication/x:Description/em:id', ns)]
# RDF Description is in its own RDF namespace, not XUL.
rdfns = {"rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#", "em": ns["em"]}
ids = [x.text for x in rdf.findall('.//em:targetApplication/rdf:Description/em:id', rdfns)]
assert len(ids) == 2, ids
assert '{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}' in ids
assert '{ec8030f7-c20a-464f-9b0e-13a3a9e97384}' in ids
assert "settingsBackup.js" not in (root / 'uxp/chrome/content/browserOverlay.xul').read_text(), 'Backup must be options-only'
print("PASS b3a1 options layout and manifest compatibility")
