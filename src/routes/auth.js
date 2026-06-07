const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { signToken, authenticate, formatAuthUser } = require('../middleware/auth');

const router = express.Router();

const PORTAL_ROLES = {
  resident: ['RESIDENT'],
  admin: ['ORG_ADMIN', 'SUPER_ADMIN'],
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

    if (portal === 'porteria' && user.role === 'ORG_STAFF' && user.staffType !== 'porteria') {
      return res.status(403).json({ error: 'No tienes acceso al portal de portería' });
    }

    const token = signToken(user);

    res.json({
      token,
      user: formatAuthUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticate, (req, res) => {
  const token = signToken(req.user);
  res.json({
    token,
    user: formatAuthUser(req.user),
  });
});

module.exports = router;
