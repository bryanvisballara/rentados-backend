const PlatformSetting = require('../models/PlatformSetting');

const RESIDENT_APP_KEY = 'resident-app';

const RESIDENT_APP_SECTIONS = [
  {
    key: 'administracion',
    label: 'Administración',
    description: 'Pestaña Admin: estado de la unidad y pagos de administración.',
    defaultEnabled: true,
  },
  {
    key: 'facturas',
    label: 'Facturas',
    description: 'Pestaña Facturas: servicios públicos.',
    defaultEnabled: true,
  },
  {
    key: 'servicios',
    label: 'Servicios',
    description: 'Pestaña Servicios: servicios a domicilio.',
    defaultEnabled: false,
  },
  {
    key: 'shop',
    label: 'Shop',
    description: 'Pestaña Shop: tienda.',
    defaultEnabled: true,
  },
  {
    key: 'restaurantes',
    label: 'Restaurantes',
    description: 'Pestaña Restaurantes: pedidos de comida.',
    defaultEnabled: false,
  },
  {
    key: 'reservas',
    label: 'Servicios y reservas',
    description: 'Zonas comunes en el inicio, como BBQ, gimnasio o salón.',
    defaultEnabled: true,
  },
  {
    key: 'publicaciones',
    label: 'Publicaciones',
    description: 'Avisos del conjunto en el inicio.',
    defaultEnabled: true,
  },
  {
    key: 'casillero',
    label: 'Casillero',
    description: 'Paquetes en portería, desde el inicio.',
    defaultEnabled: true,
  },
  {
    key: 'visitantes',
    label: 'Visitantes',
    description: 'Registrar visitantes desde el inicio.',
    defaultEnabled: true,
  },
  {
    key: 'sos',
    label: 'SOS',
    description: 'Botón de emergencia.',
    defaultEnabled: true,
  },
];

function defaultSections() {
  return Object.fromEntries(RESIDENT_APP_SECTIONS.map((item) => [item.key, item.defaultEnabled]));
}

function mergeSections(stored) {
  const source = stored && typeof stored === 'object' ? stored : {};
  const sections = {};
  for (const item of RESIDENT_APP_SECTIONS) {
    sections[item.key] =
      typeof source[item.key] === 'boolean' ? source[item.key] : item.defaultEnabled;
  }
  return sections;
}

function toCatalog(sections) {
  return RESIDENT_APP_SECTIONS.map((item) => ({
    key: item.key,
    label: item.label,
    description: item.description,
    enabled: sections[item.key] !== false,
  }));
}

async function loadResidentAppSections() {
  let doc = await PlatformSetting.findOne({ key: RESIDENT_APP_KEY });
  if (!doc) {
    try {
      doc = await PlatformSetting.create({
        key: RESIDENT_APP_KEY,
        sections: defaultSections(),
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
      doc = await PlatformSetting.findOne({ key: RESIDENT_APP_KEY });
    }
  }
  return mergeSections(doc?.sections);
}

async function saveResidentAppSections(patch) {
  const current = await loadResidentAppSections();
  const incoming = patch && typeof patch === 'object' ? patch : {};
  for (const item of RESIDENT_APP_SECTIONS) {
    if (typeof incoming[item.key] === 'boolean') current[item.key] = incoming[item.key];
  }
  await PlatformSetting.findOneAndUpdate(
    { key: RESIDENT_APP_KEY },
    { $set: { sections: current } },
    { upsert: true }
  );
  return current;
}

module.exports = {
  RESIDENT_APP_SECTIONS,
  loadResidentAppSections,
  saveResidentAppSections,
  toCatalog,
};
