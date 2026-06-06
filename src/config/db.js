const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI no está definida');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    dbName: 'rentados',
  });

  console.log('MongoDB conectado — database: rentados');
}

module.exports = { connectDB };
