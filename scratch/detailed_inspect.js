const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function detailedInspect() {
  const mongoUri = process.env.MONGO_URI || "mongodb+srv://kskvasu:admin@kskvasu25.k9jesab.mongodb.net/KSK";
  await mongoose.connect(mongoUri);

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const LedgerTransaction = mongoose.model('LedgerTransaction', new mongoose.Schema({}, { strict: false }));

  const users = await User.find({});
  console.log("=== ALL USERS ===");
  for (const u of users) {
    const txns = await LedgerTransaction.find({ user: u._id });
    const activeTxns = txns.filter(t => !t.isDeleted);
    const deletedTxns = txns.filter(t => t.isDeleted);
    console.log(`User: [${u._id}] Name: "${u.name}" | Mobile: "${u.mobile}" | isAddedToLedger: ${u.isAddedToLedger} | isDeleted: ${u.isDeleted} | Active Txns: ${activeTxns.length} | Deleted Txns: ${deletedTxns.length}`);
  }

  await mongoose.disconnect();
}

detailedInspect().catch(console.error);
