const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function inspectLedgers() {
  const mongoUri = process.env.MONGO_URI || "mongodb+srv://kskvasu:admin@kskvasu25.k9jesab.mongodb.net/KSK";
  await mongoose.connect(mongoUri);

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const LedgerTransaction = mongoose.model('LedgerTransaction', new mongoose.Schema({}, { strict: false }));

  console.log("=== USERS WITH isDeleted: true ===");
  const deletedUsers = await User.find({ isDeleted: true });
  for (const u of deletedUsers) {
    console.log(`\nUser: ${u._id} | Name: "${u.name}" | Mobile: "${u.mobile}" | ledgerType: "${u.ledgerType}" | isAddedToLedger: ${u.isAddedToLedger}`);
    const txns = await LedgerTransaction.find({ user: u._id });
    console.log(`  Total Txns: ${txns.length} (Active: ${txns.filter(t=>!t.isDeleted).length}, Deleted: ${txns.filter(t=>t.isDeleted).length})`);
  }

  console.log("\n=== DELETED TRANSACTIONS DETAILS ===");
  const deletedTxns = await LedgerTransaction.find({ isDeleted: true });
  for (const t of deletedTxns) {
    const owner = await User.findById(t.user);
    console.log(`Txn ${t._id}: user=${t.user} (${owner ? owner.name : 'N/A'}, isDeleted=${owner ? owner.isDeleted : 'N/A'}), amt=${t.amount}, type=${t.type}, desc="${t.description}", date=${t.date}`);
  }

  await mongoose.disconnect();
}

inspectLedgers().catch(console.error);
