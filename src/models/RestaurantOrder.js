const mongoose = require('mongoose');

const restaurantOrderItemSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RestaurantMenuItem',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'COP' },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const restaurantOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true, index: true },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    restaurantName: { type: String, required: true, trim: true },
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
    items: {
      type: [restaurantOrderItemSchema],
      required: true,
      validate: [(value) => value.length > 0, 'Pedido vacío'],
    },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'COP' },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
      default: 'pending',
      index: true,
    },
    statusNote: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RestaurantOrder', restaurantOrderSchema);
