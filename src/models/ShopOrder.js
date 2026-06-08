const mongoose = require('mongoose');

const shopOrderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShopProduct',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'COP' },
  },
  { _id: false }
);

const shopOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true, index: true },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resident',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    buildingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      required: true,
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: true,
      index: true,
    },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    buildingName: { type: String, trim: true },
    unitNumber: { type: String, trim: true },
    unitTower: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
    items: { type: [shopOrderItemSchema], required: true, validate: [(v) => v.length > 0, 'Pedido vacío'] },
    subtotal: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'COP' },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'delivered', 'cancelled'],
      default: 'pending',
      index: true,
    },
    statusNote: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ShopOrder', shopOrderSchema);
