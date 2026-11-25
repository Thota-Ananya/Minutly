const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const HttpError = require('../utils/httpError');
const wrap = require('../utils/wrap');

const router = express.Router();

const shape = (p) => ({
  id: String(p._id),
  name: p.name,
  detail: p.detail,
  category: p.category,
  price: p.price,
  emoji: p.emoji,
  stock: p.stock,
});

router.get(
  '/',
  wrap(async (req, res) => {
    const products = await Product.find({ active: true }).sort({ category: 1, name: 1 });
    res.json(products.map(shape));
  })
);

// Possible backups for one product: same group, in stock, price not higher than the original.
router.get(
  '/:id/substitutes',
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid product.');
    const original = await Product.findById(req.params.id);
    if (!original || !original.active) throw new HttpError(404, 'Product not found.');
    const subs = await Product.find({
      active: true,
      subGroup: original.subGroup,
      price: { $lte: original.price },
      stock: { $gt: 0 },
      _id: { $ne: original._id },
    }).sort({ price: -1, name: 1 });
    res.json(subs.map(shape));
  })
);

module.exports = router;
