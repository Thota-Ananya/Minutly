const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const HttpError = require('../utils/httpError');
const wrap = require('../utils/wrap');
const { requireAuth, requireStaff } = require('../middleware/auth');
const { computeFinalTotal, serializeOrder } = require('../utils/orderLogic');

const router = express.Router();
router.use(requireAuth, requireStaff);

const forStaff = async (id) => serializeOrder(await Order.findById(id).populate('user', 'name phone'));

async function getOrderAndItem(orderId, itemId) {
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(itemId)) throw new HttpError(400, 'Invalid request.');
  const order = await Order.findById(orderId);
  if (!order) throw new HttpError(404, 'Order not found.');
  const item = order.items.id(itemId);
  if (!item) throw new HttpError(404, 'Item not found.');
  return { order, item };
}

function assertOpen(order) {
  if (!['placed', 'packing'].includes(order.status)) throw new HttpError(409, 'This order is already closed.');
}

// ---- Orders list: ?view=open (default) | completed | cancelled ----
router.get(
  '/orders',
  wrap(async (req, res) => {
    const view = req.query.view || 'open';
    const filter =
      view === 'completed' ? { status: 'completed' } : view === 'cancelled' ? { status: 'cancelled' } : { status: { $in: ['placed', 'packing'] } };
    const sort = view === 'open' ? { createdAt: 1 } : { createdAt: -1 };
    const orders = await Order.find(filter).sort(sort).limit(100).populate('user', 'name phone');
    res.json(orders.map(serializeOrder));
  })
);

// ---- Item found and packed ----
router.post(
  '/orders/:orderId/items/:itemId/packed',
  wrap(async (req, res) => {
    const { order, item } = await getOrderAndItem(req.params.orderId, req.params.itemId);
    assertOpen(order);
    if (item.status !== 'pending') throw new HttpError(409, 'This item is already handled.');
    item.status = 'packed';
    order.status = 'packing';
    order.finalTotal = computeFinalTotal(order.items);
    await order.save();
    res.json({ order: await forStaff(order._id) });
  })
);

// ---- Item NOT on the shelf: apply the customer's choice automatically ----
router.post(
  '/orders/:orderId/items/:itemId/unavailable',
  wrap(async (req, res) => {
    const { order, item } = await getOrderAndItem(req.params.orderId, req.params.itemId);
    assertOpen(order);
    if (item.status !== 'pending') throw new HttpError(409, 'This item is already handled.');

    // The shelf is empty, so the system stock becomes 0
    await Product.updateOne({ _id: item.product }, { stock: 0 });

    let outcome = 'refunded';
    let message = `${item.name} removed from the bill. The customer chose a refund.`;
    if (item.backup) {
      const taken = await Product.findOneAndUpdate(
        { _id: item.backup.product, active: true, stock: { $gte: item.qty } },
        { $inc: { stock: -item.qty } }
      );
      if (taken) {
        outcome = 'substituted';
        message = `Pack ${item.backup.name} instead. This is the customer's chosen backup.`;
      } else {
        message = `The customer's backup (${item.backup.name}) is also out of stock, so ${item.name} is removed from the bill.`;
      }
    }
    item.status = outcome;
    order.status = 'packing';
    order.finalTotal = computeFinalTotal(order.items);
    await order.save();
    res.json({ order: await forStaff(order._id), outcome, message });
  })
);

// ---- Undo a packing decision ----
router.post(
  '/orders/:orderId/items/:itemId/undo',
  wrap(async (req, res) => {
    const { order, item } = await getOrderAndItem(req.params.orderId, req.params.itemId);
    assertOpen(order);
    if (item.status === 'pending') throw new HttpError(409, 'Nothing to undo.');
    if (item.status === 'substituted' && item.backup) {
      await Product.updateOne({ _id: item.backup.product }, { $inc: { stock: item.qty } });
    }
    item.status = 'pending';
    order.finalTotal = computeFinalTotal(order.items);
    await order.save();
    res.json({ order: await forStaff(order._id) });
  })
);

// ---- Finish the order ----
router.post(
  '/orders/:orderId/complete',
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.orderId)) throw new HttpError(400, 'Invalid order.');
    const order = await Order.findById(req.params.orderId);
    if (!order) throw new HttpError(404, 'Order not found.');
    assertOpen(order);
    if (order.items.some((i) => i.status === 'pending')) throw new HttpError(409, 'Please handle every item first.');
    order.status = 'completed';
    order.completedAt = new Date();
    order.finalTotal = computeFinalTotal(order.items);
    await order.save();
    res.json({ order: await forStaff(order._id) });
  })
);

// ---- Inventory: change stock number ----
router.post(
  '/products/:id/stock',
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid product.');
    const stock = Number(req.body && req.body.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 100000) throw new HttpError(400, 'Stock must be a whole number from 0 to 100000.');
    const p = await Product.findByIdAndUpdate(req.params.id, { stock }, { new: true });
    if (!p) throw new HttpError(404, 'Product not found.');
    res.json({ id: String(p._id), stock: p.stock });
  })
);

// ---- Real numbers for the analytics page ----
const istDate = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD

router.get(
  '/stats',
  wrap(async (req, res) => {
    const counts = await Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
    const byStatus = { placed: 0, packing: 0, completed: 0, cancelled: 0 };
    counts.forEach((c) => (byStatus[c._id] = c.n));

    const completed = await Order.find({ status: 'completed' }).select('items finalTotal').lean();
    let items = 0, packed = 0, substituted = 0, refunded = 0, revenue = 0, completeBaskets = 0, ordersWithStockout = 0;
    for (const o of completed) {
      revenue += o.finalTotal;
      let stockoutHere = false;
      let allFulfilled = true;
      for (const i of o.items) {
        items += 1;
        if (i.status === 'packed') packed += 1;
        else if (i.status === 'substituted') { substituted += 1; stockoutHere = true; }
        else if (i.status === 'refunded') { refunded += 1; stockoutHere = true; allFulfilled = false; }
      }
      if (stockoutHere) ordersWithStockout += 1;
      if (allFulfilled) completeBaskets += 1;
    }
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

    // Orders per day for the last 7 days (India time)
    const since = new Date(Date.now() - 8 * 86400000);
    const recent = await Order.find({ createdAt: { $gte: since }, status: { $ne: 'cancelled' } }).select('createdAt').lean();
    const perDay = {};
    recent.forEach((o) => { const k = istDate(o.createdAt); perDay[k] = (perDay[k] || 0) + 1; });
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const k = istDate(Date.now() - i * 86400000);
      last7.push({ date: k, count: perDay[k] || 0 });
    }

    const stockouts = substituted + refunded;
    res.json({
      byStatus,
      completedOrders: completed.length,
      revenue,
      avgOrderValue: completed.length ? Math.round(revenue / completed.length) : null,
      itemsPacked: items,
      itemFillRate: pct(packed + substituted, items),
      completeBasketRate: pct(completeBaskets, completed.length),
      ordersWithStockoutRate: pct(ordersWithStockout, completed.length),
      stockoutItems: stockouts,
      stockoutRecoveredRate: pct(substituted, stockouts),
      refundRate: pct(refunded, items),
      last7,
    });
  })
);

module.exports = router;
