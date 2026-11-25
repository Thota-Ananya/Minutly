const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    detail: { type: String, default: '' }, // e.g. "1 L"
    category: { type: String, required: true }, // shown as filter chips: Dairy, Staples...
    subGroup: { type: String, required: true }, // products in the same group can replace each other
    price: { type: Number, required: true, min: 0 },
    emoji: { type: String, default: '🛒' },
    stock: { type: Number, required: true, min: 0, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
