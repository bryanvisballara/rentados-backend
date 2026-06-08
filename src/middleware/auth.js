const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { createTokenJti, touchUserSession } = require('../utils/userSession');

const ADMIN_ROLES = ['SUPER_ADMIN', 'ORG_ADMIN'];
const PORTERIA_ROLES = ['ORG_STAFF'];

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no está definida');
  return secret;
}

function signToken(user) {
  const jti = createTokenJti();
  const token = jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      organizationId: user.organizationId?.toString() || null,
      staffType: user.staffType || null,
      jti,
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
  return { token, jti };
}

function formatAuthUser(user) {
  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    staffType: user.staffType,
    organizationId: user.organizationId,
    buildingId: user.buildingId,
  };
}

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, getJwtSecret());
    let user;

    try {
      user = await User.findById(payload.sub).select('-passwordHash');
    } catch (dbErr) {
      console.error('Auth DB error:', dbErr.message);
      return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
    }

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Sesión inválida' });
    }

    if (payload.jti) {
      touchUserSession(payload.jti).catch(() => {});
    }

    req.user = user;
    req.auth = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesión expirada' });
    }
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  return requireRoles(...ADMIN_ROLES)(req, res, next);
}

function requireSuperAdmin(req, res, next) {
  return requireRoles('SUPER_ADMIN')(req, res, next);
}

function getOrganizationFilter(user) {
  if (user.role === 'SUPER_ADMIN') return {};
  return { organizationId: user.organizationId };
}

module.exports = {
  signToken,
  formatAuthUser,
  authenticate,
  requireRoles,
  requireAdmin,
  requireSuperAdmin,
  getOrganizationFilter,
  ADMIN_ROLES,
  PORTERIA_ROLES,
};
