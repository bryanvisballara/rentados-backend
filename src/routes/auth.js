const express = require('express');
const bcrypt = require('bcryptjs');
const { User, ServiceProvider, ServiceCategory } = require('../models');
const { signToken, authenticate, formatAuthUser } = require('../middleware/auth');
const { createUserSession } = require('../utils/userSession');

const router = express.Router();

const PORTAL_ROLES = {
  resident: ['RESIDENT'],
  admin: ['ORG_ADMIN', 'SUPER_ADMIN'],
  superadmin: ['SUPER_ADMIN'],
  provider: ['PROVIDER'],
  porteria: ['ORG_STAFF'],
};

router.post('/login', async (req, res) => {
  try {
    const { email, password, portal = 'resident' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
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
      categoryIds,
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
    res.status(400).json({ error: err.message });
  }
});

router.get('/service-categories', async (_req, res) => {
  try {
    const categories = await ServiceCategory.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
