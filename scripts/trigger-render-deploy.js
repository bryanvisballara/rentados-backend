require('dotenv').config();

const hookUrl = process.env.RENDER_DEPLOY_HOOK_URL;

if (!hookUrl) {
  console.error('RENDER_DEPLOY_HOOK_URL no está definida en .env');
  process.exit(1);
}

async function triggerRenderDeploy() {
  const res = await fetch(hookUrl, { method: 'POST' });
  const text = await res.text();

  if (!res.ok) {
    console.error(`Render deploy hook falló (${res.status}): ${text || res.statusText}`);
    process.exit(1);
  }

  console.log('Render deploy iniciado:', text || res.statusText);
}

triggerRenderDeploy().catch((err) => {
  console.error('No se pudo llamar al webhook de Render:', err.message);
  process.exit(1);
});
