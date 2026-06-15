import re

file_path = r"d:\KSK\HOST\KSK REACT\KSK1\V_1 - Main\client\src\admin\CustomerLedger.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Normalize content to LF first, then replace, then write back with normalized line endings.
original_has_crlf = "\r\n" in content
lf_content = content.replace("\r\n", "\n")

target_1 = """                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>10-Digit Mobile *</label>
                                <input
                                    type="text"
                                    required
                                    maxLength="10"
                                    value={duplicateMobile}
                                    onChange={(e) => setDuplicateMobile(e.target.value.replace(/\\D/g, ''))}
                                    style={formInputStyle}
                                    placeholder="Enter new 10-digit mobile number"
                                />"""

replacement_1 = """                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>10-Digit Mobile *</label>
                                <input
                                    type="tel"
                                    required
                                    maxLength="10"
                                    value={duplicateMobile}
                                    onChange={(e) => setDuplicateMobile(e.target.value.replace(/\\D/g, ''))}
                                    style={formInputStyle}
                                    placeholder="Enter new 10-digit mobile number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                />"""

if target_1 in lf_content:
    lf_content = lf_content.replace(target_1, replacement_1)
    print("Replaced target_1 successfully.")
else:
    print("Warning: target_1 not found.")

target_2 = """                                <div style={formGroupStyle}>
                                    <label style={formLabelStyle}>Mobile *</label>
                                    <input style={formInputStyle} value={editMobile} onChange={e => setEditMobile(e.target.value.replace(/[^0-9.]/g, '').slice(0, 10))} placeholder="10-digit mobile" />
                                </div>"""

replacement_2 = """                                <div style={formGroupStyle}>
                                    <label style={formLabelStyle}>Mobile *</label>
                                    <input style={formInputStyle} type="tel" value={editMobile} onChange={e => setEditMobile(e.target.value.replace(/\\D/g, '').slice(0, 10))} placeholder="10-digit mobile" inputMode="numeric" pattern="[0-9]*" />
                                </div>"""

if target_2 in lf_content:
    lf_content = lf_content.replace(target_2, replacement_2)
    print("Replaced target_2 successfully.")
else:
    print("Warning: target_2 not found.")

target_3 = """                                <div style={formGroupStyle}>
                                    <label style={formLabelStyle}>Alt Mobile</label>
                                    <input style={formInputStyle} value={editAltMobile} onChange={e => setEditAltMobile(e.target.value.replace(/[^0-9.]/g, '').slice(0, 10))} placeholder="Alt mobile number" />
                                </div>"""

replacement_3 = """                                <div style={formGroupStyle}>
                                    <label style={formLabelStyle}>Alt Mobile</label>
                                    <input style={formInputStyle} type="tel" value={editAltMobile} onChange={e => setEditAltMobile(e.target.value.replace(/\\D/g, '').slice(0, 10))} placeholder="Alt mobile number" inputMode="numeric" pattern="[0-9]*" />
                                </div>"""

if target_3 in lf_content:
    lf_content = lf_content.replace(target_3, replacement_3)
    print("Replaced target_3 successfully.")
else:
    print("Warning: target_3 not found.")

if original_has_crlf:
    final_content = lf_content.replace("\n", "\r\n")
else:
    final_content = lf_content

with open(file_path, "w", encoding="utf-8") as f:
    f.write(final_content)
print("Finished writing file.")
