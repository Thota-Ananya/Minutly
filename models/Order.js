const mongoose = require('mongoose');
const { Schema } = mongoose;

const backupSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    detail: String,
    emoji: String,
    unitPrice: Number,
  },
  { _id: false }
);

const itemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  detail: String,
  emoji: String,
  unitPrice: { type: Number, required: true },
  qty: { type: Number, required: true, min: 1 },
  // pending -> packed | substituted | refunded
  status: { type: String, enum: ['pending', 'packed', 'substituted', 'refunded'], default: 'pending' },
  // The customer's chosen backup item (null means "refund me instead")
  backup: { type: backupSchema, default: null },
});

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    address: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      line1: { type: String, required: true },
      city: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    paymentMethod: { type: String, enum: ['cod'], default: 'cod' },
    status: { type: String, enum: ['placed', 'packing', 'completed', 'cancelled'], default: 'placed', index: true },
    estimatedTotal: { type: Number, required: true },
    finalTotal: { type: Number, required: true },
    completedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
