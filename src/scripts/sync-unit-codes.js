require('dotenv').config();

const mongoose = require('mongoose');
const { Unit } = require('../models');
const { buildUnitCode } = require('../utils/unitCode');

async function syncUnitCodes() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI no está definida');

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { dbName: 'rentados' });
  console.log('MongoDB conectado — database: rentados');

  const units = await Unit.find({ towerId: { $ne: null } }).populate('towerId', 'name code');

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  const errors = [];

  for (const unit of units) {
    const tower = unit.towerId;
    if (!tower?.code) {
      skipped += 1;
      continue;
    }

    const code = buildUnitCode({
      towerCode: tower.code,
      floor: unit.floor,
      number: unit.number,
    });

    if (!code) {
      skipped += 1;
      errors.push({
        number: unit.number,
        tower: tower.name,
        reason: 'No se pudo calcular el código (revisa piso o número)',
      });
      continue;
    }

    if (unit.code === code) {
      unchanged += 1;
      continue;
    }

    try {
      unit.code = code;
      await unit.save();
      updated += 1;
      console.log(`${tower.name} apto ${unit.number} → ${code}`);
    } catch (err) {
      errors.push({
        number: unit.number,
        tower: tower.name,
        code,
        error: err.message,
      });
    }
  }

  console.log('\n--- Resumen ---');
  console.log(`Actualizadas: ${updated}`);
  console.log(`Ya correctas: ${unchanged}`);
  console.log(`Omitidas: ${skipped}`);
  console.log(`Errores: ${errors.length}`);

  if (errors.length) {
    console.log('\nPrimeros errores:');
    for (const item of errors.slice(0, 15)) {
      console.log(`- ${item.tower || '?'} ${item.number}: ${item.error || item.reason}`);
    }
  }

  await mongoose.disconnect();
  process.exit(errors.length ? 1 : 0);
}

syncUnitCodes().catch((err) => {
  console.error(err);
  process.exit(1);
});
