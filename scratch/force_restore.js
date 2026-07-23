const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

// We import the actual models to avoid any schema compilation issues
const User = require('../models/User');
const LedgerTransaction = require('../models/LedgerTransaction');

async function syncUserLedger(userId) {
  const txns = await LedgerTransaction.find({ user: userId, isClosed: { $ne: true }, isDeleted: { $ne: true } });

  let totalYouGave = 0;
  let totalYouGot = 0;

  const user = await User.findById(userId);

  for (const t of txns) {
    if (t.type === 'credit') {
      totalYouGave += t.amount;
    } else if (t.type === 'debit') {
      totalYouGot += t.amount;
    }
  }

  let netBalance = totalYouGot - totalYouGave;
  if (user && user.openingBalance) {
    if (user.openingBalanceType === 'credit') {
      netBalance += user.openingBalance;
    } else if (user.openingBalanceType === 'debit') {
      netBalance -= user.openingBalance;
    }
  }

  await User.findByIdAndUpdate(userId, {
    netBalance,
    totalYouGave,
    totalYouGot
  }, { new: true });
}

async function forceRestore() {
  const mongoUri = process.env.MONGO_URI || "mongodb+srv://kskvasu:admin@kskvasu25.k9jesab.mongodb.net/KSK";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  // 1. Restore all deleted ledger users
  // We will search for all users who have isAddedToLedger = true and isDeleted = true, and restore them.
  const usersToRestore = await User.find({ isAddedToLedger: true, isDeleted: true });
  console.log(`\nFound ${usersToRestore.length} deleted ledger users to restore:`);
  for (const u of usersToRestore) {
    const res = await User.updateOne({ _id: u._id }, { $set: { isDeleted: false } });
    console.log(`Restored User [${u._id}] "${u.name}" (Mobile: ${u.mobile}):`, res);
  }

  // 2. Restore all deleted transactions
  const txnsToRestore = await LedgerTransaction.find({ isDeleted: true });
  console.log(`\nFound ${txnsToRestore.length} deleted ledger transactions to restore:`);
  for (const t of txnsToRestore) {
    const res = await LedgerTransaction.updateOne(
      { _id: t._id },
      { 
        $set: { 
          isDeleted: false,
          deleteRequest: {
            isRequested: false,
            requestedBy: undefined,
            requestedAt: undefined,
            status: 'active'
          }
        } 
      }
    );
    console.log(`Restored Txn [${t._id}] amount ${t.amount}:`, res);
  }

  // 3. Sync balances
  const allLedgerUsers = await User.find({ isAddedToLedger: true });
  console.log(`\nRe-synchronizing ledger balances for ${allLedgerUsers.length} ledger users...`);
  for (const u of allLedgerUsers) {
    await syncUserLedger(u._id);
    const updatedUser = await User.findById(u._id);
    const activeTxnLength = await LedgerTransaction.countDocuments({ user: u._id, isDeleted: false });
    console.log(`User [${updatedUser._id}] "${updatedUser.name}" | Net Balance: ${updatedUser.netBalance} | Total Gave: ${updatedUser.totalYouGave} | Total Got: ${updatedUser.totalYouGot} | Active Txns: ${activeTxnLength}`);
  }

  await mongoose.disconnect();
  console.log("\nDone!");
}

forceRestore().catch(console.error);
