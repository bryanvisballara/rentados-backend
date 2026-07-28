require('dotenv').config();

const mongoose = require('mongoose');
const { Building } = require('../models');

async function updateParadisoAddress() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI no está definida');

  await mongoose.connect(uri, { dbName: 'rentados' });

  const result = await Building.updateOne(
    { slug: 'paraiso-caribe' },
    {
      $set: {
        'address.street': 'Cra 75 # 78-54',
        'address.city': 'Barranquilla',
        'address.state': 'Atlántico',
        'address.country': 'Colombia',
        description: 'Conjunto residencial en Barranquilla',
      },
    }
  );

  const building = await Building.findOne({ slug: 'paraiso-caribe' }).select('name address');
  console.log('Actualizado:', result.modifiedCount);
  console.log(building?.name, building?.address);

  await mongoose.disconnect();
}

updateParadisoAddress().catch((err) => {
  console.error(err);
  process.exit(1);
});
