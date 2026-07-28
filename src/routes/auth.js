const express = require('express');
const bcrypt = require('bcryptjs');
const { User, ServiceProvider, ServiceCategory, Building, Resident } = require('../models');
const { signToken, authenticate, formatAuthUser } = require('../middleware/auth');
const { createUserSession } = require('../utils/userSession');
const { formatServiceCategory, resolveActiveCategoryIds } = require('../utils/serviceCategory');

const router = express.Router();

const PORTAL_ROLES = {
  resident: ['RESIDENT'],
  admin: ['ORG_ADMIN', 'SUPER_ADMIN'],
  superadmin: ['SUPER_ADMIN'],
  provider: ['PROVIDER'],
  porteria: ['ORG_STAFF'],
};

function formatLoginBuilding(building) {
  return {
    id: building._id,
    name: building.name,
    slug: building.slug,
    street: building.address?.street || '',
    city: building.address?.city || '',
    state: building.address?.state || '',
    country: building.address?.country || 'Colombia',
    organizationId: building.organizationId,
  };
}

const SUPPORTED_LOGIN_COUNTRIES = ['Colombia', 'México'];

router.get('/login-countries', async (_req, res) => {
  try {
    const countries = await Building.distinct('address.country', { isActive: { $ne: false } });
    const merged = [...new Set([...SUPPORTED_LOGIN_COUNTRIES, ...countries.filter(Boolean)])];
    const sorted = merged.sort((a, b) => a.localeCompare(b, 'es'));
    res.json({ countries: sorted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/login-buildings', async (req, res) => {
  try {
    const { country, q } = req.query;
    const filter = { isActive: { $ne: false } };
    if (country) filter['address.country'] = country;

    let buildings = await Building.find(filter)
      .select('name slug address.street address.city address.state address.country organizationId')
      .sort({ name: 1 })
      .lean();

    if (q) {
      const search = String(q).toLowerCase().trim();
      buildings = buildings.filter((building) => {
        const haystack = [
          building.name,
          building.slug,
          building.address?.street,
          building.address?.city,
          building.address?.state,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    res.json({ buildings: buildings.map(formatLoginBuilding) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, portal = 'resident', buildingId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const loginId = String(email).toLowerCase().trim();
    let user;
    let building = null;

    if (portal === 'resident') {
      if (!buildingId) {
        return res.status(400).json({ error: 'Selecciona tu conjunto residencial' });
      }

      building = await Building.findOne({ _id: buildingId, isActive: { $ne: false } });
      if (!building) {
        return res.status(400).json({ error: 'Conjunto residencial no encontrado' });
      }

      user = await User.findOne({
        email: loginId,
        organizationId: building.organizationId,
        role: 'RESIDENT',
      });
    } else {
      user = await User.findOne({ email: loginId });
    }

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const allowedRoles = PORTAL_ROLES[portal];
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'No tienes acceso a este portal' });
    }

    if (portal === 'resident') {
      const resident = await Resident.findOne({ userId: user._id }).populate(
        'unitId',
        'buildingId number code'
      );
      const unitBuildingId = resident?.unitId?.buildingId?.toString();
      if (!resident || unitBuildingId !== building._id.toString()) {
        return res.status(401).json({ error: 'Credenciales inválidas para este conjunto' });
      }
    }

    if (portal === 'admin' && user.role === 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'Usa el portal de super administración en /super-admin/login',
      });
    }

    if (portal === 'porteria' && user.role === 'ORG_STAFF' && user.staffType !== 'porteria') {
      return res.status(403).json({ error: 'No tienes acceso al portal de portería' });
    }

    if (portal === 'provider' && user.role === 'PROVIDER') {
      const provider = await ServiceProvider.findOne({ userId: user._id });
      if (provider && provider.approvalStatus === 'rejected') {
        return res.status(403).json({ error: 'Tu solicitud como prestador fue rechazada' });
      }
    }

    const { token, jti } = signToken(user);
    await createUserSession(user, req, jti, portal);

    res.json({
      token,
      user: formatAuthUser(user),
      building: building ? formatLoginBuilding(building) : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  const token = req.headers.authorization?.slice(7);
  if (req.auth?.jti) {
    const { touchUserSession } = require('../utils/userSession');
    await touchUserSession(req.auth.jti).catch(() => {});
  }

  res.json({
    token,
    user: formatAuthUser(req.user),
  });
});

router.post('/register-provider', async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      businessName,
      description,
      categoryIds = [],
    } = req.body;

    if (!email || !password || !firstName || !lastName || !businessName) {
      return res.status(400).json({
        error: 'Correo, contraseña, nombre y nombre del negocio son requeridos',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ error: 'El correo ya está registrado' });

    const resolvedCategoryIds = await resolveActiveCategoryIds(ServiceCategory, categoryIds);

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      firstName,
      lastName,
      phone,
      role: 'PROVIDER',
    });

    const provider = await ServiceProvider.create({
      userId: user._id,
      businessName,
      description,
      categoryIds: resolvedCategoryIds,
      approvalStatus: 'pending',
      isVerified: false,
      isActive: true,
    });

    const { token, jti } = signToken(user);
    await createUserSession(user, req, jti, 'provider');

    res.status(201).json({
      token,
      user: formatAuthUser(user),
      provider,
      message: 'Solicitud enviada. Te contactaremos para la entrevista.',
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/service-categories', async (_req, res) => {
  try {
    const categories = await ServiceCategory.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    res.json({ categories: categories.map(formatServiceCategory) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/gmail/callback', async (req, res) => {
  const { getWebAppUrl } = require('../utils/gmailOAuth');
  const { completeGmailConnect } = require('../utils/gmailUtilitySync');
  try {
    if (req.query.error) {
      return res.redirect(
        `${getWebAppUrl()}/app/servicios-publicos?gmail=error&message=${encodeURIComponent(
          String(req.query.error)
        )}`
      );
    }
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send('Falta code/state de Google OAuth');
    }
    const result = await completeGmailConnect({ code, state });
    return res.redirect(result.redirectUrl);
  } catch (err) {
    return res.redirect(
      `${getWebAppUrl()}/app/servicios-publicos?gmail=error&message=${encodeURIComponent(err.message)}`
    );
  }
});

module.exports = router;
