require('dotenv').config();

const bcrypt = require('bcryptjs');
const { connectDB } = require('../config/db');
const { Organization, Building, Tower, Unit, User, Resident } = require('../models');
const {
  PARAISO_TOWER_FLOORS,
  buildTowerUnitRows,
} = require('../utils/towerUnitLayout');

async function seedMexicoDemo() {
  await connectDB();

  const existing = await Building.findOne({ slug: 'residencial-pacifico' });
  if (existing) {
    console.log('Demo México ya existe:', existing.name);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash('Rentados2026!', 10);

  const org = await Organization.create({
    name: 'Residencial Pacífico',
    slug: 'residencial-pacifico',
    nit: 'RFC900000000',
    email: 'contacto@pacifico.mx',
    phone: '+52 55 1234 5678',
    plan: 'pro',
    settings: {
      billing: {
        monthlyInterestRatePercent: 1.5,
        gracePeriodDays: 5,
        maxInterestMonths: 12,
        defaultAdministrationFee: 420000,
      },
      locker: { enabled: true, receiveWhenOverdue: true, notifyWhenOverdue: true },
    },
  });

  const building = await Building.create({
    organizationId: org._id,
    name: 'Residencial Pacífico',
    slug: 'residencial-pacifico',
    address: {
      street: 'Av. Insurgentes Sur 1234',
      city: 'Ciudad de México',
      state: 'CDMX',
      country: 'México',
    },
    description: 'Conjunto residencial demo en México',
    towers: ['Torre 1'],
  });

  const tower = await Tower.create({
    organizationId: org._id,
    buildingId: building._id,
    name: 'Torre 1',
    code: '1',
    floors: 12,
    sortOrder: 1,
  });

  const unitRows = buildTowerUnitRows(org._id, building._id, tower, PARAISO_TOWER_FLOORS);
  const units = await Unit.insertMany(unitRows);

  const orgAdmin = await User.create({
    email: 'admin@pacifico.mx',
    passwordHash,
    firstName: 'María',
    lastName: 'López',
    phone: '+52 55 9876 5432',
    role: 'ORG_ADMIN',
    organizationId: org._id,
  });

  const residentUnit = units.find((unit) => unit.code === '1101');
  const mxUser = await User.create({
    email: '41201',
    passwordHash,
    firstName: 'Jorge',
    lastName: 'Mendoza',
    phone: '+52 55 5555 4120',
    role: 'RESIDENT',
    organizationId: org._id,
  });

  await Resident.create({
    userId: mxUser._id,
    organizationId: org._id,
    unitId: residentUnit._id,
    relationship: 'owner',
    isPrimary: true,
  });

  console.log('Demo México creado');
  console.log(`  Conjunto: ${building.name} (${building.address.country})`);
  console.log(`  Admin:    ${orgAdmin.email}`);
  console.log(`  Residente demo (mismo código que CO): 41201 / Rentados2026! → apto ${residentUnit.code}`);

  process.exit(0);
}

seedMexicoDemo().catch((err) => {
  console.error(err);
  process.exit(1);
});
