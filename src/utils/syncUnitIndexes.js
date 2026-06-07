const mongoose = require('mongoose');
const { Unit } = require('../models');

const OBSOLETE_UNIT_INDEX = 'buildingId_1_number_1';

async function syncUnitIndexes() {
  if (mongoose.connection.readyState !== 1) return;

  const collection = Unit.collection;
  const indexes = await collection.indexes();

  if (indexes.some((idx) => idx.name === OBSOLETE_UNIT_INDEX)) {
    await collection.dropIndex(OBSOLETE_UNIT_INDEX);
    console.log(`Índice obsoleto eliminado en units: ${OBSOLETE_UNIT_INDEX}`);
  }

  await Unit.syncIndexes();
}

module.exports = { syncUnitIndexes, OBSOLETE_UNIT_INDEX };
