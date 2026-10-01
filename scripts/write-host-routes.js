const fs = require('fs');
const path = require('path');

const hostDir = path.join(__dirname, '..', 'host');
const html = fs.readFileSync(path.join(hostDir, 'index.html'));

const routes = [
  'privacidad',
  'soporte',
  'marketing',
  'login',
  'admin',
  'admin/login',
  'admin/conjuntos',
  'admin/torres',
  'admin/asignacion',
  'admin/servicios',
  'admin/servicios/reservas',
  'admin/publicaciones',
  'admin/porteria',
  'admin/parqueaderos',
  'admin/contabilidad',
  'admin/cartera',
  'admin/pagos',
  'admin/morosidad',
  'admin/residentes',
  'super-admin',
  'super-admin/login',
  'super-admin/app-residente',
  'super-admin/conjuntos',
  'super-admin/servicios-rentados',
  'super-admin/servicios',
  'super-admin/solicitudes-prestadores',
  'super-admin/cronograma-prestadores',
  'super-admin/prestadores',
  'super-admin/servicios-publicos',
  'super-admin/publicaciones',
  'super-admin/shop',
  'super-admin/shop-pedidos',
  'super-admin/restaurantes',
  'super-admin/restaurantes-pedidos',
  'porteria',
  'porteria/login',
  'porteria/casillero',
  'porteria/reservas',
  'porteria/visitantes',
  'porteria/parqueadero',
  'porteria/notificaciones',
  'porteria/registrar-paquete',
  'porteria/bitacora',
  'app',
  'app/administracion',
  'app/servicios-publicos',
  'app/prestadores',
  'app/shop',
  'app/restaurantes',
  'app/servicios-conjunto',
  'provider/login',
  'provider/register',
];

const parents = new Set(
  routes.filter((route) => routes.some((other) => other.startsWith(`${route}/`)))
);

for (const route of routes) {
  if (parents.has(route)) {
    const dir = path.join(hostDir, route);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    continue;
  }

  const filePath = path.join(hostDir, route);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    fs.rmSync(filePath, { recursive: true, force: true });
  }
  fs.writeFileSync(filePath, html);
}

console.log(`Rutas estáticas escritas: ${routes.length}`);
