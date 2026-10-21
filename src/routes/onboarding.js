const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const EmailVerification = require('../models/EmailVerification');
const Organization = require('../models/Organization');
const Building = require('../models/Building');
const Tower = require('../models/Tower');
const Unit = require('../models/Unit');
const Facility = require('../models/Facility');
const User = require('../models/User');
const { slugify } = require('../utils/tenantContext');
const { sendBrevoEmail } = require('../utils/brevoMail');

const router = express.Router();

function clean(value) {
  return String(value || '').trim();
}

function slugFrom(value) {
  const base = slugify(value);
  return base || `conjunto-${Date.now().toString(36)}`;
}

function uniqueSlug(base, taken) {
  let slug = slugFrom(base);
  if (!taken.has(slug)) {
    taken.add(slug);
    return slug;
  }
  let index = 2;
  while (taken.has(`${slug}-${index}`)) index += 1;
  const next = `${slug}-${index}`;
  taken.add(next);
  return next;
}

async function availableOrgSlug(base) {
  let slug = slugFrom(base);
  let index = 2;
  while (await Organization.exists({ slug })) {
    slug = `${slugFrom(base)}-${index}`;
    index += 1;
  }
  return slug;
}

function parseNumber(value) {
  if (value === '' || value == null) return null;
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

async function assertEmailVerified(email, verificationToken) {
  const token = clean(verificationToken);
  if (!token) {
    const error = new Error('Verifica el correo antes de crear el conjunto.');
    error.statusCode = 400;
    throw error;
  }
  const record = await EmailVerification.findOne({
    email,
    tokenHash: hashValue(token),
    verifiedAt: { $ne: null },
    expiresAt: { $gt: new Date() },
  });
  if (!record) {
    const error = new Error('La verificación del correo venció. Solicita un código nuevo.');
    error.statusCode = 400;
    throw error;
  }
}

router.post('/codigo', async (req, res) => {
  try {
    const email = clean(req.body?.email).toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Escribe un correo válido.' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Ese correo ya tiene una cuenta en Rentados.' });

    const recent = await EmailVerification.findOne({ email }).sort({ lastSentAt: -1 });
    if (recent?.lastSentAt && Date.now() - new Date(recent.lastSentAt).getTime() < 45000) {
      return res.status(429).json({ error: 'Espera un momento antes de pedir otro código.' });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await EmailVerification.findOneAndUpdate(
      { email },
      {
        email,
        codeHash: hashValue(code),
        tokenHash: '',
        verifiedAt: null,
        expiresAt,
        lastSentAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const digits = code.split('');
    const digitCells = digits
      .map(
        (digit) =>
          `<td style="width:44px;height:52px;background:#f7f3eb;border:1px solid #e4ddd0;border-radius:12px;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:600;color:#1e3d32;letter-spacing:0;">${digit}</td>`
      )
      .join('<td style="width:8px;"></td>');

    await sendBrevoEmail({
      to: email,
      subject: 'Tu código de Rentados',
      html: `
        <div style="margin:0;padding:32px 16px;background:#f7f3eb;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px;font-family:Georgia,'Times New Roman',serif;font-size:28px;color:#1e3d32;">Rentados</td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:1.4px;text-transform:uppercase;color:#2d6a4f;font-weight:700;">Verificación</td>
            </tr>
            <tr>
              <td style="padding:0 32px 12px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;color:#1e3d32;">Tu código para crear el edificio</td>
            </tr>
            <tr>
              <td style="padding:0 32px 22px;font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#4d6358;">Escríbelo en la pantalla de Rentados. Caduca en 10 minutos.</td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0"><tr>${digitCells}</tr></table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 24px;background:#1e3d32;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#f7f3eb;">Si no pediste este código, puedes ignorar este correo.</td>
            </tr>
          </table>
        </div>
      `,
    });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'No se pudo enviar el código.' });
  }
});

router.post('/codigo/confirmar', async (req, res) => {
  try {
    const email = clean(req.body?.email).toLowerCase();
    const code = clean(req.body?.code);
    const record = await EmailVerification.findOne({
      email,
      codeHash: hashValue(code),
      expiresAt: { $gt: new Date() },
    });
    if (!record) return res.status(400).json({ error: 'El código no es válido o ya venció.' });

    const verificationToken = crypto.randomBytes(24).toString('hex');
    record.tokenHash = hashValue(verificationToken);
    record.verifiedAt = new Date();
    record.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await record.save();
    return res.json({ ok: true, verificationToken });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'No se pudo verificar el código.' });
  }
});

function parseDate(value) {
  const raw = clean(value);
  if (!raw) return undefined;
  const date = new Date(`${raw}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

router.post('/edificio', async (req, res) => {
  const body = req.body || {};
  const buildingName = clean(body.buildingName);
  const city = clean(body.city);
  const street = clean(body.address || body.street);
  const email = clean(body.email).toLowerCase();
  const password = String(body.password || '');
  const adminWhatsapp = clean(body.adminWhatsapp);
  const receptionWhatsapp = clean(body.receptionWhatsapp);
  const feeMode = body.feeMode === 'per_type' ? 'per_type' : 'per_sqm';
  const feePerSqm = parseNumber(body.feePerSqm);
  const towers = Array.isArray(body.towers) ? body.towers : [];
  const facilities = Array.isArray(body.facilities) ? body.facilities : [];
  const porteriaUsers = Array.isArray(body.porteriaUsers) ? body.porteriaUsers : [];
  const locker = body.locker && typeof body.locker === 'object' ? body.locker : {};

  if (!buildingName) return res.status(400).json({ error: 'Escribe el nombre del conjunto.' });
  if (!city || !street) return res.status(400).json({ error: 'Ciudad y dirección son obligatorias.' });
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Correo no válido.' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  if (!towers.length) return res.status(400).json({ error: 'Agrega al menos una torre.' });
  try {
    await assertEmailVerified(email, body.verificationToken);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    return res.status(400).json({ error: 'Ese correo ya tiene una cuenta en Rentados.' });
  }

  const staffEmails = [];
  for (const person of porteriaUsers) {
    const staffEmail = clean(person.email).toLowerCase();
    if (!staffEmail && !clean(person.firstName)) continue;
    if (!staffEmail || !clean(person.firstName) || !clean(person.lastName) || !String(person.password || '')) {
      return res.status(400).json({ error: 'Completa nombre, apellido, correo y contraseña de portería.' });
    }
    if (staffEmail === email || staffEmails.includes(staffEmail)) {
      return res.status(400).json({ error: 'Los correos de administración y portería deben ser distintos.' });
    }
    staffEmails.push(staffEmail);
  }
  if (staffEmails.length) {
    const taken = await User.findOne({ email: { $in: staffEmails } });
    if (taken) return res.status(400).json({ error: `El correo ${taken.email} ya está registrado.` });
  }

  const created = { organizationId: null, buildingId: null, userIds: [] };

  try {
    const orgSlug = await availableOrgSlug(buildingName);
    const organization = await Organization.create({
      name: buildingName,
      slug: orgSlug,
      email,
      phone: adminWhatsapp,
      plan: 'trial',
      settings: {
        timezone: 'America/Bogota',
        currency: 'COP',
        billing: {
          administrationFeePerSqm: feeMode === 'per_sqm' ? feePerSqm : undefined,
          administrationFeePerM3: feeMode === 'per_sqm' ? feePerSqm : undefined,
        },
        locker: {
          enabled: Boolean(locker.enabled),
          receiveWhenOverdue: locker.receiveWhenOverdue !== false,
          notifyWhenOverdue: true,
        },
        contacts: {
          adminWhatsapp,
          receptionWhatsapp,
        },
      },
    });
    created.organizationId = organization._id;

    const building = await Building.create({
      organizationId: organization._id,
      name: buildingName,
      slug: orgSlug,
      address: {
        street,
        city,
        country: 'Colombia',
      },
      towers: towers.map((tower, index) => clean(tower.name) || `Torre ${index + 1}`),
    });
    created.buildingId = building._id;

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await User.create({
      email,
      passwordHash,
      firstName: buildingName.slice(0, 80),
      lastName: 'Administración',
      phone: adminWhatsapp,
      role: 'ORG_ADMIN',
      organizationId: organization._id,
      buildingId: building._id,
    });
    created.userIds.push(admin._id);

    for (const person of porteriaUsers) {
      const staffEmail = clean(person.email).toLowerCase();
      if (!staffEmail) continue;
      const staffHash = await bcrypt.hash(String(person.password), 10);
      const staff = await User.create({
        email: staffEmail,
        passwordHash: staffHash,
        firstName: clean(person.firstName),
        lastName: clean(person.lastName),
        phone: clean(person.phone),
        role: 'ORG_STAFF',
        staffType: 'porteria',
        organizationId: organization._id,
        buildingId: building._id,
      });
      created.userIds.push(staff._id);
    }

    const usedSlugs = new Set();
    const usedCodes = new Set();
    let towerIndex = 0;
    for (const towerInput of towers) {
      towerIndex += 1;
      const name = clean(towerInput.name) || `Torre ${towerIndex}`;
      const code = uniqueSlug(name, usedCodes).replace(/-/g, '').slice(0, 12).toUpperCase() || `T${towerIndex}`;
      const tower = await Tower.create({
        organizationId: organization._id,
        buildingId: building._id,
        name,
        code,
        sortOrder: towerIndex,
      });

      const units = Array.isArray(towerInput.units) ? towerInput.units : [];
      for (const unitInput of units) {
        const number = clean(unitInput.number);
        if (!number) continue;
        const areaSqm = parseNumber(unitInput.areaSqm);
        const administrationFee =
          feeMode === 'per_type' ? parseNumber(unitInput.administrationFee) : undefined;
        const unitCode = `${code}${number}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || `${code}${towerIndex}${number}`;
        await Unit.create({
          organizationId: organization._id,
          buildingId: building._id,
          towerId: tower._id,
          tower: name,
          number,
          code: unitCode,
          type: 'apartment',
          areaSqm: areaSqm ?? undefined,
          administrationFee: administrationFee ?? undefined,
        });
      }
    }

    for (const facilityInput of facilities) {
      const name = clean(facilityInput.name);
      if (!name) continue;
      const slug = uniqueSlug(name, usedSlugs);
      const bookable = Boolean(facilityInput.bookable);
      const mode = ['free', 'hourly', 'blocks', 'flat'].includes(facilityInput.pricingMode)
        ? facilityInput.pricingMode
        : 'free';
      const hasSeason = facilityInput.seasonMode === 'season';
      await Facility.create({
        organizationId: organization._id,
        buildingId: building._id,
        name,
        slug,
        bookable,
        blockWhenOverdue: facilityInput.blockWhenOverdue !== false,
        openHours: {
          start: clean(facilityInput.openStart) || '06:00',
          end: clean(facilityInput.openEnd) || '22:00',
        },
        seasonOpenDate: hasSeason ? parseDate(facilityInput.seasonOpen) : undefined,
        seasonCloseDate: hasSeason ? parseDate(facilityInput.seasonClose) : undefined,
        pricingType: bookable ? (mode === 'hourly' ? 'per_hour' : mode === 'blocks' ? 'per_block' : mode === 'flat' ? 'per_use' : 'free') : 'free',
        bookingPricing: bookable
          ? {
              mode,
              hourlyRate: parseNumber(facilityInput.hourlyRate) || 0,
              flatPrice: parseNumber(facilityInput.flatPrice) || 0,
              blocks: Array.isArray(facilityInput.blocks)
                ? facilityInput.blocks
                    .map((block) => ({
                      label: clean(block.label) || `${block.durationMinutes || 60} min`,
                      durationMinutes: Number(block.durationMinutes) || 60,
                      price: parseNumber(block.price) || 0,
                    }))
                    .filter((block) => block.durationMinutes >= 15)
                : [],
            }
          : undefined,
        bookingRules: {
          minAdvanceBookingDays: parseNumber(facilityInput.advanceDays) || 0,
          advanceBookingDays: 30,
        },
      });
    }

    return res.status(201).json({
      ok: true,
      buildingId: String(building._id),
      organizationId: String(organization._id),
      email,
    });
  } catch (err) {
    if (created.userIds.length) await User.deleteMany({ _id: { $in: created.userIds } });
    if (created.buildingId) {
      await Promise.all([
        Unit.deleteMany({ buildingId: created.buildingId }),
        Tower.deleteMany({ buildingId: created.buildingId }),
        Facility.deleteMany({ buildingId: created.buildingId }),
        Building.deleteOne({ _id: created.buildingId }),
      ]);
    }
    if (created.organizationId) await Organization.deleteOne({ _id: created.organizationId });
    const message = err.code === 11000 ? 'Ya existe un conjunto o correo con esos datos.' : err.message;
    return res.status(400).json({ error: message || 'No se pudo crear el conjunto.' });
  }
});

module.exports = router;
