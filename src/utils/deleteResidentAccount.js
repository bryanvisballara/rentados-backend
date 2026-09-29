const {
  User,
  Resident,
  UserSession,
  SavedPaymentMethod,
  GmailConnection,
  ResidentNotification,
  ResidentVisitorRequest,
  ResidentUtilityAccount,
  RestaurantOrder,
  ShopOrder,
  Payment,
} = require('../models');

async function deleteResidentAccount(userId) {
  const user = await User.findById(userId);
  if (!user || user.role !== 'RESIDENT') {
    const error = new Error('Solo un residente puede eliminar su cuenta desde la app');
    error.status = 403;
    throw error;
  }

  const resident = await Resident.findOne({ userId: user._id });
  const residentId = resident?._id;
  const removedIdentity = {
    customerName: 'Cuenta eliminada',
    customerEmail: '',
    customerPhone: '',
  };

  await Promise.all([
    UserSession.deleteMany({ userId: user._id }),
    SavedPaymentMethod.deleteMany({ userId: user._id }),
    GmailConnection.deleteMany({ userId: user._id }),
    ResidentNotification.deleteMany({ userId: user._id }),
    residentId ? ResidentVisitorRequest.deleteMany({ residentId }) : Promise.resolve(),
    residentId ? ResidentUtilityAccount.deleteMany({ residentId }) : Promise.resolve(),
    RestaurantOrder.updateMany({ userId: user._id }, { $set: removedIdentity }),
    ShopOrder.updateMany({ userId: user._id }, { $set: removedIdentity }),
    residentId ? Payment.updateMany({ residentId }, { $unset: { residentId: '' } }) : Promise.resolve(),
  ]);

  if (resident) await resident.deleteOne();
  await user.deleteOne();
}

module.exports = { deleteResidentAccount };
