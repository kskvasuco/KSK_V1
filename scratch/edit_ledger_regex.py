file_path = r"d:\KSK\HOST\KSK REACT\KSK1\V_1 - Main\client\src\admin\CustomerLedger.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

import re

# Let's check for duplicateMobile input
dup_pattern = r"(<input\s+[^>]*?value=\{duplicateMobile\}[^>]*?>)"
match = re.search(dup_pattern, content, re.DOTALL)
if match:
    tag = match.group(1)
    print("Found duplicateMobile tag:", repr(tag))
    new_tag = tag
    # Change type="text" to type="tel" if type="text" in tag
    new_tag = new_tag.replace('type="text"', 'type="tel"')
    # Add inputMode and pattern if not present
    if "inputMode" not in new_tag:
        # Check if it ends with />
        if "/>" in new_tag:
            new_tag = new_tag.replace('/>', '    inputMode="numeric"\n                                    pattern="[0-9]*"\n                                />')
    content = content.replace(tag, new_tag)
    print("Replaced duplicateMobile tag.")
else:
    print("Could not find duplicateMobile tag via regex.")

# Let's check for editMobile input
edit_mob_pattern = r"(<input\s+[^>]*?value=\{editMobile\}[^>]*?>)"
match = re.search(edit_mob_pattern, content, re.DOTALL)
if match:
    tag = match.group(1)
    print("Found editMobile tag:", repr(tag))
    new_tag = tag
    if 'type="tel"' not in new_tag:
        # insert type="tel"
        new_tag = new_tag.replace('<input ', '<input type="tel" ')
    # fix onChange replace regex if it was [^0-9.]
    new_tag = new_tag.replace('replace(/[^0-9.]/g', 'replace(/\\D/g')
    if "inputMode" not in new_tag:
        if "/>" in new_tag:
            new_tag = new_tag.replace('/>', 'inputMode="numeric" pattern="[0-9]*" />')
    content = content.replace(tag, new_tag)
    print("Replaced editMobile tag.")
else:
    print("Could not find editMobile tag via regex.")

# Let's check for editAltMobile input
edit_alt_pattern = r"(<input\s+[^>]*?value=\{editAltMobile\}[^>]*?>)"
match = re.search(edit_alt_pattern, content, re.DOTALL)
if match:
    tag = match.group(1)
    print("Found editAltMobile tag:", repr(tag))
    new_tag = tag
    if 'type="tel"' not in new_tag:
         new_tag = new_tag.replace('<input ', '<input type="tel" ')
    new_tag = new_tag.replace('replace(/[^0-9.]/g', 'replace(/\\D/g')
    if "inputMode" not in new_tag:
        if "/>" in new_tag:
            new_tag = new_tag.replace('/>', 'inputMode="numeric" pattern="[0-9]*" />')
    content = content.replace(tag, new_tag)
    print("Replaced editAltMobile tag.")
else:
    print("Could not find editAltMobile tag via regex.")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Finished.")
