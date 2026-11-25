// Pure helper functions (no database) so the business rules are easy to read and test.

// Substitute rule (V1): same substitute group, still on sale, and price NOT higher than the original.
function isValidSubstitute(original, candidate) {
  if (!original || !candidate) return false;
  if (String(original._id) === String(candidate._id)) return false;
  if (!candidate.active) return false;
  if (original.subGroup !== candidate.subGroup) return false;
  return candidate.price <= original.price;
}

// How much the customer pays for one line after packing decisions.
function lineTotal(item) {
  if (item.status === 'substituted' && item.backup) return item.backup.unitPrice * item.qty;
  if (item.status === 'refunded') return 0;
  return item.unitPrice * item.qty; // pending or packed
}

function computeFinalTotal(items) {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

function serializeOrder(order) {
  const o = order.toObject ? order.toObject() : order;
  const populatedUser = o.user && o.user.name ? o.user : null;
  return {
    id: String(o._id),
    orderNumber: o.orderNumber,
    status: o.status,
    createdAt: o.createdAt,
    completedAt: o.completedAt || null,
    estimatedTotal: o.estimatedTotal,
    finalTotal: o.finalTotal,
    moneyBack: Math.max(0, o.estimatedTotal - o.finalTotal),
    paymentMethod: o.paymentMethod,
    address: o.address,
    customer: populatedUser ? { name: populatedUser.name, phone: populatedUser.phone || '' } : null,
    items: o.items.map((i) => ({
      id: String(i._id),
      name: i.name,
      detail: i.detail,
      emoji: i.emoji,
      unitPrice: i.unitPrice,
      qty: i.qty,
      status: i.status,
      backup: i.backup
        ? { name: i.backup.name, detail: i.backup.detail, emoji: i.backup.emoji, unitPrice: i.backup.unitPrice }
        : null,
      lineTotal: lineTotal(i),
    })),
  };
}

module.exports = { isValidSubstitute, lineTotal, computeFinalTotal, serializeOrder };
