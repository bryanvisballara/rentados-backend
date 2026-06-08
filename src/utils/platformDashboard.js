const { Payment } = require('../models');

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function startOfMonth(date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

function startOfYear(date) {
  const d = startOfDay(date);
  d.setMonth(0, 1);
  return d;
}

async function aggregatePaymentPeriod(since, until = new Date()) {
  const match = {
    status: 'paid',
    paidAt: { $gte: since, $lte: until },
    concept: 'administration',
  };

  const [result] = await Payment.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'units',
        localField: 'unitId',
        foreignField: '_id',
        as: 'unit',
      },
    },
    { $unwind: '$unit' },
    {
      $lookup: {
        from: 'buildings',
        localField: 'unit.buildingId',
        foreignField: '_id',
        as: 'building',
      },
    },
    { $unwind: '$building' },
    {
      $group: {
        _id: null,
        volume: { $sum: '$paidAmount' },
        transactions: { $sum: 1 },
        platformRevenue: {
          $sum: {
            $multiply: [
              '$paidAmount',
              {
                $divide: [
                  { $ifNull: ['$building.platformCommissionPercent', 3] },
                  100,
                ],
              },
            ],
          },
        },
      },
    },
  ]);

  return {
    volume: result?.volume || 0,
    transactions: result?.transactions || 0,
    platformRevenue: Math.round(result?.platformRevenue || 0),
  };
}

async function getPlatformDashboardStats() {
  const now = new Date();

  const [day, week, month, year, totals] = await Promise.all([
    aggregatePaymentPeriod(startOfDay(now), now),
    aggregatePaymentPeriod(startOfWeek(now), now),
    aggregatePaymentPeriod(startOfMonth(now), now),
    aggregatePaymentPeriod(startOfYear(now), now),
    aggregatePaymentPeriod(new Date(0), now),
  ]);

  const {
    Organization,
    Building,
    User,
    ServiceProvider,
    ProviderInterview,
    ShopCategory,
    ShopProduct,
    ShopOrder,
  } = require('../models');

  const [
    organizations,
    buildings,
    pendingProviders,
    approvedProviders,
    upcomingInterviews,
    shopCategories,
    shopProducts,
    pendingShopOrders,
  ] = await Promise.all([
    Organization.countDocuments({ isActive: true }),
    Building.countDocuments({ isActive: true }),
    ServiceProvider.countDocuments({ approvalStatus: 'pending' }),
    ServiceProvider.countDocuments({ approvalStatus: 'approved', isActive: true }),
    ProviderInterview.countDocuments({
      status: 'scheduled',
      scheduledAt: { $gte: now },
    }),
    ShopCategory.countDocuments({ isActive: true }),
    ShopProduct.countDocuments({ isActive: true }),
    ShopOrder.countDocuments({ status: 'pending' }),
  ]);

  return {
    finance: { day, week, month, year, totals },
    counts: {
      organizations,
      buildings,
      pendingProviders,
      approvedProviders,
      upcomingInterviews,
      shopCategories,
      shopProducts,
      pendingShopOrders,
    },
  };
}

module.exports = {
  getPlatformDashboardStats,
  aggregatePaymentPeriod,
};
