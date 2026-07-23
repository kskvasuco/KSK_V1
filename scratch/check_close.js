const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function checkCloseBalances() {
  const mongoUri = process.env.MONGO_URI || "mongodb+srv://kskvasu:admin@kskvasu25.k9jesab.mongodb.net/KSK";
  await mongoose.connect(mongoUri);

  const LedgerCloseBalance = mongoose.model('LedgerCloseBalance', new mongoose.Schema({}, { strict: false }));
  const records = await LedgerCloseBalance.find({});
  console.log("LedgerCloseBalance count:", records.length);
  records.forEach(r => console.log(r));

  await mongoose.disconnect();
}

checkCloseBalances().catch(console.error);
