const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Product = require('../models/Product');
const Order = require('../models/Order');
const HttpError = require('../utils/httpError');
const wrap = require('../utils/wrap');
const { requireAuth } = require('../middleware/auth');
const { isValidSubstitute, serializeOrder } = require('../utils/orderLogic');

const router = express.Router();
router.use(requireAuth);

const MAX_QTY = 10;

function cleanAddress(a) {
  a = a || {};
  const out = {
    name: String(a.name || '').trim(),
    phone: String(a.phone || '').trim(),
    line1: String(a.line1 || '').trim(),
    city: String(a.city || '').trim(),
    pincode: String(a.pincode || '').trim(),
  };
  if (out.name.length < 2 || out.name.length > 60) throw new HttpError(400, 'Please enter the receiver name.');
  if (!/^[6-9]\d{9}$/.test(out.phone)) throw new HttpError(400, 'Phone must be a 10 digit Indian mobile number.');
  if (out.line1.length < 5 || out.line1.length > 200) throw new HttpError(400, 'Please enter your full address (house no, street, area).');
  if (out.city.length < 2 || out.city.length > 60) throw new HttpError(400, 'Please enter your city.');
  if (!/^\d{6}$/.test(out.pincode)) throw new HttpError(400, 'Pincode must be 6 digits.');
  return out;
}

// ---- Place an order ----
router.post(
  '/',
  wrap(async (req, res) => {
    const { items, address, paymentMethod } = req.body || {};
    if (!Array.isArray(items) || items.length < 1 || items.length > 30) throw new HttpError(400, 'Your basket is empty.');
    if (paymentMethod !== 'cod') throw new HttpError(400, 'Only Cash on Delivery is available right now.');
    const addr = cleanAddress(address);

    // Merge duplicate products and validate ids / quantities
    const merged = new Map();
    for (const it of items) {
      if (!it || !mongoose.isValidObjectId(it.productId)) throw new HttpError(400, 'One of the items is invalid.');
      const qty = Number(it.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new HttpError(400, `Quantity must be between 1 and ${MAX_QTY}.`);
      let substituteId = null;
      if (it.substituteId) {
        if (!mongoose.isValidObjectId(it.substituteId)) throw new HttpError(400, 'Invalid substitute.');
        substituteId = String(it.substituteId);
      }
      const key = String(it.productId);
      const prev = merged.get(key);
      merged.set(key, { productId: key, qty: Math.min(MAX_QTY, (prev ? prev.qty : 0) + qty), substituteId });
    }
    const wanted = [...merged.values()];

    // Load every product we need in one query
    const ids = new Set();
    wanted.forEach((w) => {
      ids.add(w.productId);
      if (w.substituteId) ids.add(w.substituteId);
    });
    const docs = await Product.find({ _id: { $in: [...ids] } });
    const byId = new Map(docs.map((d) => [String(d._id), d]));

    const orderItems = [];
    for (const w of wanted) {
      const p = byId.get(w.productId);
      if (!p || !p.active) throw new HttpError(400, 'An item in your basket is no longer sold. Please refresh your basket.');
      let backup = null;
      if (w.substituteId) {
        const s = byId.get(w.substituteId);
        if (!isValidSubstitute(p, s)) throw new HttpError(400, `That backup is not allowed for ${p.name}.`);
        backup = { product: s._id, name: s.name, detail: s.detail, emoji: s.emoji, unitPrice: s.price };
      }
      orderItems.push({ product: p._id, name: p.name, detail: p.detail, emoji: p.emoji, unitPrice: p.price, qty: w.qty, backup });
    }

    // Reserve stock (undo everything if any item fails)
    const reserved = [];
    try {
      for (const it of orderItems) {
        const ok = await Product.findOneAndUpdate({ _id: it.product, stock: { $gte: it.qty } }, { $inc: { stock: -it.qty } });
        if (!ok) throw new HttpError(409, `Sorry, ${it.name} does not have enough stock right now.`);
        reserved.push(it);
      }
      const total = orderItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);
      const order = await Order.create({
        orderNumber: 'MN-' + Date.now().toString(36).toUpperCase() + crypto.randomInt(10, 99),
        user: req.user._id,
        items: orderItems,
        address: addr,
        paymentMethod: 'cod',
        estimatedTotal: total,
        finalTotal: total,
      });
      return res.status(201).json({ order: serializeOrder(order) });
    } catch (err) {
      for (const it of reserved) await Product.updateOne({ _id: it.product }, { $inc: { stock: it.qty } });
      throw err;
    }
  })
);

// ---- My orders ----
router.get(
  '/mine',
  wrap(async (req, res) => {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json(orders.map(serializeOrder));
  })
);

// ---- One order (owner or staff) ----
router.get(
  '/:id',
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid order.');
    const order = await Order.findById(req.params.id);
    if (!order || (String(order.user) !== String(req.user._id) && req.user.role !== 'staff')) throw new HttpError(404, 'Order not found.');
    res.json({ order: serializeOrder(order) });
  })
);

// ---- Cancel (only before packing starts) ----
router.post(
  '/:id/cancel',
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid order.');
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, status: 'placed' },
      { status: 'cancelled' },
      { new: true }
    );
    if (!order) throw new HttpError(409, 'This order can no longer be cancelled (packing may have started).');
    for (const it of order.items) {
      await Product.updateOne({ _id: it.product }, { $inc: { stock: it.qty } });
    }
    res.json({ order: serializeOrder(order) });
  })
);

module.exports = router;
