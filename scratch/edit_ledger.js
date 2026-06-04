const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../client/src/admin/CustomerLedger.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Edit 1: Handler functions
const handlersTargetLF = `    // Symmetrical base path\n    const isStaff = window.location.pathname.startsWith('/staff');`;
const handlersTargetCRLF = `    // Symmetrical base path\r\n    const isStaff = window.location.pathname.startsWith('/staff');`;

const handlersReplacementLF = `    const openDuplicateModal = () => {
        if (!profile) return;
        setDuplicateName(\`Copy of \${profile.name || ''}\`);
        setDuplicateMobile('');
        setIsDuplicateModalOpen(true);
    };

    const handleDuplicateCustomer = async (e) => {
        e.preventDefault();
        if (!duplicateName.trim()) {
            alert('Name is required.');
            return;
        }
        if (!/^\\d{10}$/.test(duplicateMobile.trim())) {
            alert('Mobile number must be a 10-digit number.');
            return;
        }
        setDuplicateSubmitting(true);
        try {
            const res = await adminApi.duplicateCustomer(userId, {
                name: duplicateName.trim(),
                mobile: duplicateMobile.trim()
            });
            alert('Customer duplicated successfully!');
            setIsDuplicateModalOpen(false);
            if (res && res.user && res.user._id) {
                navigate(\`\${basePath}/ledger/\${res.user._id}\`);
            } else {
                navigate(\`\${basePath}/ledger\`);
            }
        } catch (err) {
            alert('Failed to duplicate customer: ' + err.message);
        } finally {
            setDuplicateSubmitting(false);
        }
    };

    // Symmetrical base path
    const isStaff = window.location.pathname.startsWith('/staff');`;

const handlersReplacementCRLF = handlersReplacementLF.replace(/\n/g, '\r\n');

if (content.includes(handlersTargetCRLF)) {
    content = content.replace(handlersTargetCRLF, handlersReplacementCRLF);
    console.log('Handlers replaced CRLF');
} else if (content.includes(handlersTargetLF)) {
    content = content.replace(handlersTargetLF, handlersReplacementLF);
    console.log('Handlers replaced LF');
} else {
    console.error('Handlers target not found in CustomerLedger.jsx');
    process.exit(1);
}

// Edit 2: Duplicate button
const btnTargetLF = `                        <div style={{ display: 'flex', gap: '8px' }}>\n                            <button style={editProfileBtnStyle} onClick={openEditProfile}>✏️ Profile</button>`;
const btnTargetCRLF = `                        <div style={{ display: 'flex', gap: '8px' }}>\r\n                            <button style={editProfileBtnStyle} onClick={openEditProfile}>✏️ Profile</button>`;

const btnReplacementLF = `                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button style={{ ...editProfileBtnStyle, background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: 'white', border: 'none' }} onClick={openDuplicateModal}>👯 Duplicate</button>
                            <button style={editProfileBtnStyle} onClick={openEditProfile}>✏️ Profile</button>`;

const btnReplacementCRLF = btnReplacementLF.replace(/\n/g, '\r\n');

if (content.includes(btnTargetCRLF)) {
    content = content.replace(btnTargetCRLF, btnReplacementCRLF);
    console.log('Button replaced CRLF');
} else if (content.includes(btnTargetLF)) {
    content = content.replace(btnTargetLF, btnReplacementLF);
    console.log('Button replaced LF');
} else {
    console.error('Button target not found in CustomerLedger.jsx');
    process.exit(1);
}

// Edit 3: Duplicate modal
const modalTargetLF = `            {/* ═══════════════════════════════════════════\n               MODAL: EDIT USER PROFILE\n            ═══════════════════════════════════════════ */}`;
const modalTargetCRLF = `            {/* ═══════════════════════════════════════════\r\n               MODAL: EDIT USER PROFILE\r\n            ═══════════════════════════════════════════ */}`;

const modalReplacementLF = `            {/* ═══════════════════════════════════════════
               MODAL: DUPLICATE CUSTOMER/SUPPLIER
            ═══════════════════════════════════════════ */}
            {isDuplicateModalOpen && (
                <div style={modalOverlayStyle} onClick={() => setIsDuplicateModalOpen(false)}>
                    <div style={{ ...modalContentStyle, maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <h3 style={{ margin: 0, color: '#4f46e5' }}>👯 Duplicate {profile.ledgerType}</h3>
                            <button style={modalCloseBtnStyle} onClick={() => setIsDuplicateModalOpen(false)}>✕</button>
                        </div>
                        <form onSubmit={handleDuplicateCustomer} style={modalBodyStyle}>
                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={duplicateName}
                                    onChange={(e) => setDuplicateName(e.target.value)}
                                    style={formInputStyle}
                                    placeholder="Enter full name"
                                    autoFocus
                                />
                            </div>
                            <div style={formGroupStyle}>
                                <label style={formLabelStyle}>10-Digit Mobile *</label>
                                <input
                                    type="text"
                                    required
                                    maxLength="10"
                                    value={duplicateMobile}
                                    onChange={(e) => setDuplicateMobile(e.target.value.replace(/\\D/g, ''))}
                                    style={formInputStyle}
                                    placeholder="Enter new 10-digit mobile number"
                                />
                                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                                    Must be a unique 10-digit number. All other details and active ledger transactions will be duplicated.
                                </span>
                            </div>
                            <div style={modalFooterStyle}>
                                <button type="button" style={secondaryBtnStyle} onClick={() => setIsDuplicateModalOpen(false)}>Cancel</button>
                                <button
                                    type="submit"
                                    disabled={duplicateSubmitting}
                                    style={{
                                        ...submitCrBtnStyle,
                                        background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                                        boxShadow: '0 4px 10px rgba(79,70,229,0.2)',
                                        color: 'white',
                                        border: 'none'
                                    }}
                                >
                                    {duplicateSubmitting ? 'Duplicating...' : 'Duplicate Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
               MODAL: EDIT USER PROFILE
            ═══════════════════════════════════════════ */}`;

const modalReplacementCRLF = modalReplacementLF.replace(/\n/g, '\r\n');

if (content.includes(modalTargetCRLF)) {
    content = content.replace(modalTargetCRLF, modalReplacementCRLF);
    console.log('Modal replaced CRLF');
} else if (content.includes(modalTargetLF)) {
    content = content.replace(modalTargetLF, modalReplacementLF);
    console.log('Modal replaced LF');
} else {
    console.error('Modal target not found in CustomerLedger.jsx');
    process.exit(1);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('CustomerLedger.jsx updated successfully!');
