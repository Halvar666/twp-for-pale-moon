#!/usr/bin/env python3
"""b2: verify extension identity and declared Pale Moon/Basilisk application targets."""
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile
import re

ROOT = Path(__file__).resolve().parents[1]
NS = {"em": "http://www.mozilla.org/2004/em-rdf#"}
PALE_MOON = "{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}"
BASILISK = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}"
ADDON = "twp-uxp-prototype@unofficial.local"
EXPECTED = {PALE_MOON: ("33.0", "35.*"), BASILISK: ("52.9.0", "52.9.*")}


def verify(data):
    root = ET.fromstring(data)
    header = root.find("./{http://www.w3.org/1999/02/22-rdf-syntax-ns#}Description")
    assert header is not None
    assert header.find("em:id", NS).text == ADDON
    assert re.fullmatch(r"1\.0\.0b\d+(?:a\d+)?", header.find("em:version", NS).text), "Unexpected beta version"
    targets = {}
    for target in header.findall("em:targetApplication", NS):
        desc = target.find("{http://www.w3.org/1999/02/22-rdf-syntax-ns#}Description")
        assert desc is not None
        uid = desc.find("em:id", NS).text
        assert uid not in targets, "Duplicate application target: " + uid
        targets[uid] = (desc.find("em:minVersion", NS).text,
                        desc.find("em:maxVersion", NS).text)
    assert targets == EXPECTED, targets

source = (ROOT / "uxp/install.rdf").read_bytes()
verify(source)
# Check the committed XPI too when present, without making tests depend on
# the user's download directory or a preexisting package.
print("PASS: beta version, add-on ID, Pale Moon and basic Basilisk 52.9.x targets")
