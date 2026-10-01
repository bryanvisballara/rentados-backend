const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const {
  UserSession,
  Resident,
  Unit,
  Building,
  User,
} = require('../models');

const ACTIVE_WINDOW_MS = 30 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
/** Mismo usuario en varios teléfonos (p. ej. pareja); no expulsar al iniciar sesión en otro dispositivo */
const MAX_USER_SESSIONS = Math.max(
  2,
  Number.parseInt(process.env.MAX_USER_SESSIONS || '16', 10) || 16
);
const TOKEN_REFRESH_BEFORE_MS = 30 * 24 * 60 * 60 * 1000;

function getSessionExpiryDate() {
  const expiresIn = process.env.JWT_EXPIRES_IN || '3650d';
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000);

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return new Date(Date.now() + amount * multipliers[unit]);
}

async function resolveSessionBuildingId(user, req) {
  const headerBuildingId = req?.headers?.['x-building-id'];
  if (headerBuildingId) {
    const building = await Building.findById(headerBuildingId).select('_id organizationId');
    if (
      building &&
      (!user.organizationId ||
        String(building.organizationId) === String(user.organizationId) ||
        user.role === 'SUPER_ADMIN')
    ) {
      return building._id;
    }
  }

  if (user.buildingId) return user.buildingId;

  if (user.role === 'RESIDENT') {
    const resident = await Resident.findOne({ userId: user._id }).populate('unitId', 'buildingId');
    return resident?.unitId?.buildingId || null;
  }

  if (user.organizationId && ['ORG_ADMIN', 'ORG_STAFF'].includes(user.role)) {
    const building = await Building.findOne({
      organizationId: user.organizationId,
      isActive: true,
    })
      .sort({ createdAt: 1 })
      .select('_id');
    return building?._id || null;
  }

  return null;
}

async function createUserSession(user, req, jti, portal) {
  const buildingId = await resolveSessionBuildingId(user, req);
  const now = new Date();

  await UserSession.findOneAndUpdate(
    { jti },
    {
      jti,
      userId: user._id,
      organizationId: user.organizationId || null,
      buildingId,
      role: user.role,
      staffType: user.staffType || null,
      portal: portal || null,
      userAgent: req?.headers?.['user-agent']?.slice(0, 240) || null,
      ipAddress: req?.ip || req?.socket?.remoteAddress || null,
      lastSeenAt: now,
      expiresAt: getSessionExpiryDate(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await pruneUserSessions(user._id, jti);
}

async function pruneUserSessions(userId, keepJti = null) {
  const now = new Date();
  await UserSession.deleteMany({
    userId,
    expiresAt: { $lte: now },
  });

  const sessions = await UserSession.find({ userId })
    .sort({ lastSeenAt: -1 })
    .select('_id jti lastSeenAt')
    .lean();

  if (sessions.length <= MAX_USER_SESSIONS) return;

  const protectedJti = keepJti ? String(keepJti) : null;
  const overflow = sessions.slice(MAX_USER_SESSIONS);
  const idsToRemove = overflow
    .filter((session) => !protectedJti || session.jti !== protectedJti)
    .map((session) => session._id);

  if (idsToRemove.length) {
    await UserSession.deleteMany({ _id: { $in: idsToRemove } });
  }
}

function tokenNeedsRefresh(payload) {
  if (!payload?.jti) return true;
  if (!payload.exp) return true;
  const expiresAtMs = payload.exp * 1000;
  return expiresAtMs - Date.now() < TOKEN_REFRESH_BEFORE_MS;
}

async function touchUserSession(jti) {
  if (!jti) return;

  const session = await UserSession.findOne({ jti }).select('lastSeenAt');
  if (!session) return;

  const now = Date.now();
  if (now - new Date(session.lastSeenAt).getTime() < TOUCH_INTERVAL_MS) return;

  await UserSession.updateOne(
    { jti },
    {
      lastSeenAt: new Date(now),
      expiresAt: getSessionExpiryDate(),
    }
  );
}

function createTokenJti() {
  return randomUUID();
}

function decodeTokenJti(token) {
  try {
    const payload = jwt.decode(token);
    return payload?.jti || null;
  } catch {
    return null;
  }
}

module.exports = {
  ACTIVE_WINDOW_MS,
  MAX_USER_SESSIONS,
  createUserSession,
  touchUserSession,
  pruneUserSessions,
  tokenNeedsRefresh,
  createTokenJti,
  decodeTokenJti,
  resolveSessionBuildingId,
  getSessionExpiryDate,
};
