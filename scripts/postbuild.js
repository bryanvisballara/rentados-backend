const { runSeed } = require('../src/scripts/seed');

/**
 * Ejecutado en el build de Render cuando RUN_DB_SYNC=true.
 * Sincroniza MongoDB Atlas (colecciones + datos demo).
 */
async function postbuild() {
  if (process.env.RUN_DB_SYNC !== 'true') {
    console.log('RUN_DB_SYNC no activo — omitiendo sync de MongoDB');
    return;
  }

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI requerida para sync de MongoDB en Render');
    process.exit(1);
  }

  console.log('Sincronizando MongoDB Atlas desde Render build…');
  await runSeed();
  console.log('MongoDB sincronizado correctamente');
}

postbuild().catch((err) => {
  console.error('Error en postbuild:', err);
  process.exit(1);
});
