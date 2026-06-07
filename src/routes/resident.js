const express = require('express');
const { Resident, Unit, Facility, Payment, Organization } = require('../models');
const { authenticate, requireRoles } = require('../middleware/auth');
const { getBillingSettings, enrichPayment, getUnitAdministrationFee } = require('../utils/billing');
const { getActiveSuspensions, getSuspendedFacilityIds } = require('../utils/suspensions');

const router = express.Router();

router.use(authenticate, requireRoles('RESIDENT'));

async function getResidentContext(user) {
  const resident = await Resident.findOne({ userId: user._id }).populate(
    'unitId',
    'number type tower adminStatus buildingId administrationFee'
  );
  if (!resident) throw new Error('Perfil de residente no encontrado');
  return resident;
}

router.get('/billing', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const org = await Organization.findById(resident.organizationId);
    const billingSettings = getBillingSettings(org);

    const payments = await Payment.find({ unitId: resident.unitId }).sort({ dueDate: -1 }).limit(24);

    const enriched = payments.map((p) => enrichPayment(p, billingSettings));
    const totalDue = enriched.reduce((sum, p) => sum + (p.totalDue || 0), 0);
    const totalInterest = enriched.reduce((sum, p) => sum + (p.interestAmount || 0), 0);

    res.json({
      unit: resident.unitId,
      billingSettings,
      monthlyAdministrationFee: getUnitAdministrationFee(resident.unitId, billingSettings),
      summary: {
        totalDue,
        totalInterest,
        isOverdue: resident.unitId?.adminStatus === 'overdue',
      },
      payments: enriched,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/services', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const unit = resident.unitId;

    const facilities = await Facility.find({
      buildingId: unit.buildingId,
      isActive: true,
    }).sort({ name: 1 });

    const suspendedIds = await getSuspendedFacilityIds(unit._id);
    const suspensions = await getActiveSuspensions(unit._id);

    const services = facilities.map((f) => {
      const isSuspended = suspendedIds.has(f._id.toString());
      const blockedByOverdue = unit.adminStatus === 'overdue' && f.blockWhenOverdue && isSuspended;

      return {
        id: f._id,
        name: f.name,
        slug: f.slug,
        description: f.description,
        price: f.price,
        currency: f.currency,
        pricingType: f.pricingType,
        status: f.status,
        openHours: f.openHours,
        available: !isSuspended && f.status === 'open',
        blocked: isSuspended,
        blockReason: isSuspended ? 'suspension' : f.status !== 'open' ? f.status : null,
        blockedByOverdue,
      };
    });

    res.json({
      unit: { number: unit.number, adminStatus: unit.adminStatus },
      suspensions,
      services,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
