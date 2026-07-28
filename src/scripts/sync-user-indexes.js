require('dotenv').config();

const mongoose = require('mongoose');
const { User } = require('../models');

async function syncUserIndexes() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI no está definida');

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { dbName: 'rentados' });
  console.log('MongoDB conectado — database: rentados');

  const collection = User.collection;
  const indexes = await collection.indexes();
  const legacyEmailIndex = indexes.find((index) => index.name === 'email_1');

  if (legacyEmailIndex) {
    await collection.dropIndex('email_1');
    console.log('Índice legacy email_1 eliminado');
  }

  await User.syncIndexes();
  console.log('Índices de usuarios sincronizados (organizationId + email único por conjunto)');

  await mongoose.disconnect();
}

syncUserIndexes().catch((err) => {
  console.error(err);
  process.exit(1);
});
