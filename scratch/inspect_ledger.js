const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../client/src/admin/CustomerLedger.jsx');
const content = fs.readFileSync(filePath, 'utf8');

console.log('Includes duplicateName hook:', content.includes('duplicateName'));
console.log('Includes handleDuplicateCustomer:', content.includes('handleDuplicateCustomer'));
console.log('Includes Duplicate button:', content.includes('👯 Duplicate'));
console.log('Includes isDuplicateModalOpen markup:', content.includes('Duplicate {profile.ledgerType}'));
