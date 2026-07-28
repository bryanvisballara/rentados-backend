require('dotenv').config();

const mongoose = require('mongoose');
const { UtilityProvider } = require('../models');
const { BARRANQUILLA_PROVIDERS } = require('../data/utilityProvidersCatalog');
const { normalizeCity } = require('../utils/utilityServices');

async function seedUtilityProviders() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI no está definida');

  await mongoose.connect(uri, { dbName: 'rentados' });

  let upserted = 0;
  for (const item of BARRANQUILLA_PROVIDERS) {
    const cityKeys = (item.cities || []).map(normalizeCity);
    await UtilityProvider.findOneAndUpdate(
      { slug: item.slug },
      {
        $set: {
          ...item,
          cityKeys,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    upserted += 1;
    console.log(`✓ ${item.name} (${item.serviceType})`);
  }

  console.log(`\nProveedores sincronizados: ${upserted}`);
  await mongoose.disconnect();
}

seedUtilityProviders().catch((err) => {
  console.error(err);
  process.exit(1);
});
