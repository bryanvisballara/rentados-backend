const express = require('express');
const { ServiceProvider } = require('../models');
const { authenticate, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRoles('PROVIDER'));

async function getProviderProfile(userId) {
  return ServiceProvider.findOne({ userId })
    .populate('categoryIds', 'name slug')
    .populate('offerings.categoryId', 'name slug')
    .populate('userId', 'firstName lastName email phone');
}

router.get('/me', async (req, res) => {
  try {
    const provider = await getProviderProfile(req.user._id);
    if (!provider) return res.status(404).json({ error: 'Perfil de prestador no encontrado' });

    res.json({
      provider,
      user: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        phone: req.user.phone,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/offerings', async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ userId: req.user._id });
    if (!provider) return res.status(404).json({ error: 'Perfil de prestador no encontrado' });
    if (provider.approvalStatus !== 'approved') {
      return res.status(403).json({ error: 'Debes estar aprobado para publicar tarifas' });
    }

    const { offerings } = req.body;
    if (!Array.isArray(offerings)) {
      return res.status(400).json({ error: 'Envía un arreglo offerings' });
    }

    provider.offerings = offerings.map((item) => ({
      categoryId: item.categoryId,
      description: item.description?.trim() || undefined,
      pricingNotes: item.pricingNotes?.trim() || undefined,
      referencePrice:
        item.referencePrice === '' || item.referencePrice == null
          ? undefined
          : Number(item.referencePrice),
      isActive: item.isActive !== false,
    }));
    provider.markModified('offerings');
    await provider.save();

    const populated = await getProviderProfile(req.user._id);
    res.json({ provider: populated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/interviews', async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ userId: req.user._id });
    if (!provider) return res.status(404).json({ error: 'Perfil de prestador no encontrado' });

    const { ProviderInterview } = require('../models');
    const interviews = await ProviderInterview.find({ providerId: provider._id })
      .sort({ scheduledAt: 1 })
      .lean();

    res.json({ interviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
