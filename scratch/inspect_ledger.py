file_path = r"d:\KSK\HOST\KSK REACT\KSK1\V_1 - Main\client\src\admin\CustomerLedger.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

import re

for match in re.finditer("duplicateMobile", content):
    start = match.start()
    print(f"duplicateMobile found at {start}:")
    print(repr(content[start-100:start+250]))

for match in re.finditer("editMobile", content):
    start = match.start()
    print(f"editMobile found at {start}:")
    print(repr(content[start-100:start+250]))
