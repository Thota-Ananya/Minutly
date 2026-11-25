// Adds the starter grocery catalogue and the staff (packer) account.
// It runs automatically when the server starts. You can also run it by hand: npm run seed
// Safe to run many times: it never overwrites stock or prices you changed later.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Product = require('./models/Product');
const User = require('./models/User');

// name, detail, category, subGroup (who can replace whom), price (Rs), emoji, stock
const CATALOGUE = [
  ['Amul Taaza Milk', '1 L', 'Dairy', 'milk-1l', 68, '🥛', 40],
  ['Nandini Toned Milk', '1 L', 'Dairy', 'milk-1l', 64, '🥛', 40],
  ['Heritage Toned Milk', '1 L', 'Dairy', 'milk-1l', 66, '🥛', 40],
  ['Amul Butter', '100 g', 'Dairy', 'butter-100g', 60, '🧈', 40],
  ['Mother Dairy Butter', '100 g', 'Dairy', 'butter-100g', 58, '🧈', 40],
  ['Britannia Butter', '100 g', 'Dairy', 'butter-100g', 59, '🧈', 40],

  ['Aashirvaad Atta', '5 kg', 'Staples', 'atta-5kg', 285, '🌾', 30],
  ['Pillsbury Chakki Atta', '5 kg', 'Staples', 'atta-5kg', 279, '🌾', 30],
  ['Patanjali Atta', '5 kg', 'Staples', 'atta-5kg', 265, '🌾', 30],
  ['Tata Salt', '1 kg', 'Staples', 'salt-1kg', 28, '🧂', 60],
  ['Aashirvaad Salt', '1 kg', 'Staples', 'salt-1kg', 25, '🧂', 60],
  ['Catch Iodised Salt', '1 kg', 'Staples', 'salt-1kg', 27, '🧂', 60],

  ['Fortune Sunflower Oil', '1 L', 'Cooking oil', 'sunflower-oil-1l', 145, '🫗', 30],
  ['Saffola Sunflower Oil', '1 L', 'Cooking oil', 'sunflower-oil-1l', 139, '🫗', 30],
  ['Freedom Sunflower Oil', '1 L', 'Cooking oil', 'sunflower-oil-1l', 142, '🫗', 30],

  ["Lay's Classic Salted", '52 g', 'Snacks', 'chips-small', 20, '🥔', 80],
  ['Bingo Original Style', '52 g', 'Snacks', 'chips-small', 18, '🥔', 80],
  ['Uncle Chipps Plain Salted', '50 g', 'Snacks', 'chips-small', 20, '🥔', 80],

  ['Coca-Cola', '750 ml', 'Beverages', 'cola-750ml', 40, '🥤', 50],
  ['Pepsi', '750 ml', 'Beverages', 'cola-750ml', 38, '🥤', 50],
  ['Thums Up', '750 ml', 'Beverages', 'cola-750ml', 40, '🥤', 50],
  ['Tata Tea Gold', '250 g', 'Beverages', 'tea-250g', 150, '🍵', 30],
  ['Brooke Bond Red Label', '250 g', 'Beverages', 'tea-250g', 130, '🍵', 30],
  ['Wagh Bakri Tea', '250 g', 'Beverages', 'tea-250g', 120, '🍵', 30],
];

async function seedIfNeeded() {
  for (const [name, detail, category, subGroup, price, emoji, stock] of CATALOGUE) {
    await Product.updateOne(
      { name },
      { $setOnInsert: { detail, category, subGroup, price, emoji, stock, active: true } },
      { upsert: true }
    );
  }

  const isProd = process.env.NODE_ENV === 'production';
  const email = (process.env.STAFF_EMAIL || (isProd ? '' : 'packer@minutly.local')).trim().toLowerCase();
  const password = process.env.STAFF_PASSWORD || (isProd ? '' : 'ChangeMe@12345');
  if (!email || !password) {
    console.warn('[seed] STAFF_EMAIL / STAFF_PASSWORD not set, so no staff account was created.');
    return;
  }
  if (password.length < 8) {
    console.warn('[seed] STAFF_PASSWORD must be at least 8 characters. Staff account not created.');
    return;
  }
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({ name: 'Minutly Packer', email, passwordHash: await bcrypt.hash(password, 10), role: 'staff' });
    console.log(`[seed] Staff account created: ${email}`);
  } else if (existing.role !== 'staff') {
    existing.role = 'staff';
    await existing.save();
    console.log(`[seed] ${email} upgraded to staff.`);
  }
}

module.exports = { seedIfNeeded };

if (require.main === module) {
  if (!process.env.MONGODB_URI) {
    console.error('Set MONGODB_URI in your .env file first.');
    process.exit(1);
  }
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(seedIfNeeded)
    .then(() => {
      console.log('[seed] Done.');
      return mongoose.disconnect();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
