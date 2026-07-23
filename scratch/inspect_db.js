const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function inspect() {
  const mongoUri = process.env.MONGO_URI || "mongodb+srv://kskvasu:admin@kskvasu25.k9jesab.mongodb.net/KSK";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const LedgerTransaction = mongoose.model('LedgerTransaction', new mongoose.Schema({}, { strict: false }));

  // 1. Deleted Ledger Transactions
  const deletedTxns = await LedgerTransaction.find({ isDeleted: true });
  console.log("\n=== DELETED TRANSACTIONS (isDeleted: true) ===");
  console.log("Count:", deletedTxns.length);
  for (const t of deletedTxns) {
    const user = await User.findById(t.user);
    console.log(`ID: ${t._id} | User: ${user ? user.name : 'Unknown'} (${t.user}) | Amount: ${t.amount} | Type: ${t.type} | Desc: ${t.description} | Date: ${t.date}`);
  }

  // 2. Deleted Users (isDeleted: true)
  const deletedUsers = await User.find({ isDeleted: true });
  console.log("\n=== DELETED USERS (isDeleted: true) ===");
  console.log("Count:", deletedUsers.length);
  for (const u of deletedUsers) {
    const txnCount = await LedgerTransaction.countDocuments({ user: u._id });
    console.log(`User ID: ${u._id} | Name: ${u.name} | Mobile: ${u.mobile} | isAddedToLedger: ${u.isAddedToLedger} | TxnCount: ${txnCount}`);
  }

  // 3. Removed from Ledger (isAddedToLedger: false or undefined)
  const removedLedgerUsers = await User.find({ isAddedToLedger: { $ne: true } });
  console.log("\n=== USERS NOT IN LEDGER (isAddedToLedger != true) ===");
  console.log("Count:", removedLedgerUsers.length);
  for (const u of removedLedgerUsers) {
    const txnCount = await LedgerTransaction.countDocuments({ user: u._id });
    if (txnCount > 0) {
      console.log(`User ID: ${u._id} | Name: ${u.name} | Mobile: ${u.mobile} | TxnCount: ${txnCount} | isDeleted: ${u.isDeleted}`);
    }
  }

  // 4. Check Duplicate Accounts (Same name or same mobile or "Copy of")
  const allUsers = await User.find({});
  console.log("\n=== TOTAL USERS ===", allUsers.length);
  
  const copyUsers = allUsers.filter(u => u.name && u.name.includes('Copy of'));
  console.log("\n=== USERS WITH 'Copy of' IN NAME ===", copyUsers.length);
  copyUsers.forEach(u => {
    console.log(`User ID: ${u._id} | Name: ${u.name} | Mobile: ${u.mobile} | isDeleted: ${u.isDeleted} | isAddedToLedger: ${u.isAddedToLedger}`);
  });

  // Check duplicate mobiles or names
  const mobileMap = {};
  allUsers.forEach(u => {
    if (u.mobile) {
      if (!mobileMap[u.mobile]) mobileMap[u.mobile] = [];
      mobileMap[u.mobile].push(u);
    }
  });

  console.log("\n=== DUPLICATE MOBILES ===");
  for (const mob in mobileMap) {
    if (mobileMap[mob].length > 1) {
      console.log(`Mobile ${mob}:`, mobileMap[mob].map(u => ({ id: u._id, name: u.name, isDeleted: u.isDeleted, isAddedToLedger: u.isAddedToLedger })));
    }
  }

  await mongoose.disconnect();
}

inspect().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
