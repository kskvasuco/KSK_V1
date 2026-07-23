const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function syncUserLedger(userId) {
  const User = mongoose.model('User');
  const LedgerTransaction = mongoose.model('LedgerTransaction');

  // Recalculate Totals (Manual only - active/unclosed only)
  const txns = await LedgerTransaction.find({ user: userId, isClosed: { $ne: true }, isDeleted: { $ne: true } });

  let totalYouGave = 0; // Credits: You gave credit (Udhar) to the customer/supplier
  let totalYouGot = 0;  // Debits: You got payment (Mila) from the customer/supplier

  const user = await User.findById(userId);

  for (const t of txns) {
    if (t.type === 'credit') {
      totalYouGave += t.amount;
    } else if (t.type === 'debit') {
      totalYouGot += t.amount;
    }
  }

  // Outstanding net balance = totalYouGot (Mila/paid) - totalYouGave (Gave/due)
  let netBalance = totalYouGot - totalYouGave;
  if (user && user.openingBalance) {
    if (user.openingBalanceType === 'credit') {
      netBalance += user.openingBalance;
    } else if (user.openingBalanceType === 'debit') {
      netBalance -= user.openingBalance;
    }
  }

  // Update cached ledger fields
  await User.findByIdAndUpdate(userId, {
    netBalance,
    totalYouGave,
    totalYouGot
  }, { new: true });
}

async function restoreDeletedDuplicateLedgers() {
  const mongoUri = process.env.MONGO_URI || "mongodb+srv://kskvasu:admin@kskvasu25.k9jesab.mongodb.net/KSK";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const LedgerTransaction = mongoose.model('LedgerTransaction', new mongoose.Schema({}, { strict: false }));

  // 1. Find deleted users that were added to ledger or are duplicates
  const deletedLedgerUsers = await User.find({ isDeleted: true, isAddedToLedger: true });
  console.log(`\nFound ${deletedLedgerUsers.length} deleted ledger users to restore:`);
  for (const u of deletedLedgerUsers) {
    console.log(`- Restoring User [${u._id}]: "${u.name}" (Mobile: ${u.mobile})`);
    u.isDeleted = false;
    await u.save();
  }

  // 2. Find all deleted ledger transactions
  const deletedTxns = await LedgerTransaction.find({ isDeleted: true });
  console.log(`\nFound ${deletedTxns.length} deleted ledger transactions to restore:`);
  for (const t of deletedTxns) {
    const u = await User.findById(t.user);
    console.log(`- Restoring Txn [${t._id}] for ${u ? u.name : 'Unknown User (' + t.user + ')'}: Amt ${t.amount}, Type ${t.type}, Desc "${t.description}"`);
    t.isDeleted = false;
    t.deleteRequest = {
      isRequested: false,
      requestedBy: undefined,
      requestedAt: undefined,
      status: 'active'
    };
    await t.save();
  }

  // 3. Re-sync all ledger users
  const allLedgerUsers = await User.find({ isAddedToLedger: true });
  console.log(`\nRe-synchronizing ledger balances for ${allLedgerUsers.length} ledger users...`);
  for (const u of allLedgerUsers) {
    await syncUserLedger(u._id);
    const updatedUser = await User.findById(u._id);
    const activeTxnLength = await LedgerTransaction.countDocuments({ user: u._id, isDeleted: false });
    console.log(`User [${updatedUser._id}] "${updatedUser.name}" | Net Balance: ${updatedUser.netBalance} | Total Gave: ${updatedUser.totalYouGave} | Total Got: ${updatedUser.totalYouGot} | Active Txns: ${activeTxnLength}`);
  }

  console.log("\nRestoration and ledger synchronization completed successfully!");
  await mongoose.disconnect();
}

restoreDeletedDuplicateLedgers().catch(err => {
  console.error("Error executing restoration:", err);
  process.exit(1);
});
