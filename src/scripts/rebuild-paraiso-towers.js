require('dotenv').config();

const mongoose = require('mongoose');
const { Building, Tower, Unit, Resident, User } = require('../models');
const {
  PARAISO_TOWER_DEFS,
  PARAISO_TOWER_FLOORS,
  PARAISO_UNITS_PER_TOWER,
  buildTowerUnitRows,
} = require('../utils/towerUnitLayout');

const APPLY = process.argv.includes('--apply');
const RELINK_DEMO = process.argv.includes('--relink-demo');

async function relinkDemoResidents(building, organizationId) {
  const demoRelinks = [
    { email: 'residente@demo.co', code: '1101' },
    { email: 'moroso@demo.co', code: '11203' },
    { email: '41201', code: '41201' },
  ];
  for (const { email, code } of demoRelinks) {
    const user = await User.findOne({ email, organizationId });
    const unit = await Unit.findOne({ buildingId: building._id, code });
    if (!user || !unit) continue;
    const resident = await Resident.findOne({ userId: user._id, organizationId });
    if (!resident) continue;
    resident.unitId = unit._id;
    await resident.save();
    console.log(`Residente demo reasignado: ${email} → ${code}`);
  }
}

async function rebuildParadisoTowers() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI no está definida');

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { dbName: 'rentados' });
  console.log('MongoDB conectado — database: rentados');
  console.log(APPLY ? 'Modo: APLICAR cambios' : 'Modo: simulación (usa --apply para ejecutar)\n');

  const building = await Building.findOne({ slug: 'paraiso-caribe' });
  if (!building) {
    throw new Error('No se encontró el conjunto paraiso-caribe');
  }

  const organizationId = building.organizationId;
  const existingTowers = await Tower.find({ buildingId: building._id }).sort({ sortOrder: 1 });
  const existingApartments = await Unit.countDocuments({
    buildingId: building._id,
    towerId: { $ne: null },
  });

  console.log(`Conjunto: ${building.name}`);
  console.log(`Torres actuales: ${existingTowers.length} (esperadas: ${PARAISO_TOWER_DEFS.length})`);
  console.log(`Apartamentos actuales: ${existingApartments}`);
  console.log(
    `Apartamentos esperados: ${PARAISO_TOWER_DEFS.length * PARAISO_UNITS_PER_TOWER} (${PARAISO_UNITS_PER_TOWER} por torre)`
  );
  console.log(`Ejemplo código torre 4 apto 1201 → 41201\n`);

  if (RELINK_DEMO) {
    await relinkDemoResidents(building, organizationId);
    await mongoose.disconnect();
    return;
  }

  if (!APPLY) {
    console.log('Ejecuta con --apply para regenerar torres y unidades.');
    await mongoose.disconnect();
    return;
  }

  const towerByCode = new Map(existingTowers.map((tower) => [tower.code, tower]));
  const towers = [];

  for (const def of PARAISO_TOWER_DEFS) {
    let tower = towerByCode.get(def.code);
    if (!tower) {
      tower = await Tower.create({
        organizationId,
        buildingId: building._id,
        name: def.name,
        code: def.code,
        floors: def.floors,
        sortOrder: def.sortOrder,
      });
      console.log(`Torre creada: ${tower.name}`);
    } else {
      tower.name = def.name;
      tower.floors = def.floors;
      tower.sortOrder = def.sortOrder;
      await tower.save();
    }
    towers.push(tower);
  }

  const towerIds = towers.map((tower) => tower._id);
  const orphanedResidents = await Resident.countDocuments({
    organizationId,
    unitId: {
      $in: await Unit.find({ buildingId: building._id, towerId: { $in: towerIds } }).distinct('_id'),
    },
  });

  const deleteResult = await Unit.deleteMany({
    buildingId: building._id,
    towerId: { $in: towerIds },
  });
  console.log(`Apartamentos eliminados: ${deleteResult.deletedCount}`);

  if (orphanedResidents > 0) {
    console.log(
      `Advertencia: ${orphanedResidents} residente(s) pueden quedar con unitId inválido tras regenerar.`
    );
  }

  const unitRows = towers.flatMap((tower) =>
    buildTowerUnitRows(organizationId, building._id, tower, PARAISO_TOWER_FLOORS)
  );
  await Unit.insertMany(unitRows);

  await relinkDemoResidents(building, organizationId);

  building.towers = PARAISO_TOWER_DEFS.map((tower) => tower.name);
  await building.save();

  const sample = await Unit.findOne({ buildingId: building._id, code: '41201' }).populate(
    'towerId',
    'name'
  );

  console.log('\n--- Resumen ---');
  console.log(`Torres: ${towers.length}`);
  console.log(`Apartamentos creados: ${unitRows.length}`);
  if (sample) {
    console.log(`Verificado: ${sample.towerId?.name} apto ${sample.number} → código ${sample.code}`);
  }

  await mongoose.disconnect();
}

rebuildParadisoTowers().catch((err) => {
  console.error(err);
  process.exit(1);
});
