function buildOrderNumber() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SH-${stamp}-${suffix}`;
}

const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

function formatShopOrder(order) {
  return {
    id: order._id,
    _id: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status] || order.status,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    buildingName: order.buildingName,
    unitNumber: order.unitNumber,
    unitTower: order.unitTower,
    city: order.city,
    country: order.country,
    items: order.items,
    subtotal: order.subtotal,
    currency: order.currency,
    notes: order.notes,
    statusNote: order.statusNote,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    residentId: order.residentId,
    buildingId: order.buildingId,
    unitId: order.unitId,
  };
}

module.exports = { buildOrderNumber, formatShopOrder, STATUS_LABELS };
