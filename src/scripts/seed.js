require('dotenv').config();

const bcrypt = require('bcryptjs');
const { connectDB } = require('../config/db');
const {
  User,
  Organization,
  Building,
  Unit,
  Resident,
  ServiceCategory,
  ServiceProvider,
  Service,
  Facility,
  Announcement,
  QuickAction,
  EmergencyContact,
} = require('../models');

const SERVICE_CATEGORIES = [
  { name: 'Plomería', slug: 'plomeria', description: 'Reparaciones e instalaciones hidráulicas', icon: 'wrench', sortOrder: 1 },
  { name: 'Aseo', slug: 'aseo', description: 'Limpieza del apartamento', icon: 'sparkles', sortOrder: 2 },
  { name: 'Instaladores', slug: 'instaladores', description: 'Electricidad y gas', icon: 'zap', sortOrder: 3 },
  { name: 'Carpintería', slug: 'carpinteria', description: 'Muebles y reparaciones en madera', icon: 'hammer', sortOrder: 4 },
  { name: 'Gimnasio', slug: 'gimnasio', description: 'Reserva del gimnasio', icon: 'dumbbell', sortOrder: 5 },
  { name: 'Salón Social', slug: 'salon-social', description: 'Eventos y reuniones', icon: 'users', sortOrder: 6 },
  { name: 'Piscina', slug: 'piscina', description: 'Área húmeda y piscina', icon: 'waves', sortOrder: 7 },
  { name: 'Mudanzas', slug: 'mudanzas', description: 'Autorización y apoyo en mudanza', icon: 'truck', sortOrder: 8 },
];

async function seed() {
  await connectDB();

  console.log('Limpiando colecciones existentes…');
  await Promise.all([
    User.deleteMany({}),
    Organization.deleteMany({}),
    Building.deleteMany({}),
    Unit.deleteMany({}),
    Resident.deleteMany({}),
    ServiceCategory.deleteMany({}),
    ServiceProvider.deleteMany({}),
    Service.deleteMany({}),
    Facility.deleteMany({}),
    Announcement.deleteMany({}),
    QuickAction.deleteMany({}),
    EmergencyContact.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash('Rentados2026!', 10);

  const superAdmin = await User.create({
    email: 'admin@rentados.co',
    passwordHash,
    firstName: 'Super',
    lastName: 'Admin',
    role: 'SUPER_ADMIN',
  });

  const org = await Organization.create({
    name: 'Administración Torres del Parque',
    slug: 'torres-del-parque',
    nit: '900123456-1',
    email: 'contacto@torresdelparque.co',
    phone: '+57 300 123 4567',
    plan: 'pro',
  });

  const building = await Building.create({
    organizationId: org._id,
    name: 'Conjunto Torres del Parque',
    slug: 'torres-del-parque',
    address: {
      street: 'Carrera 15 # 80-45',
      city: 'Bogotá',
      state: 'Cundinamarca',
      country: 'Colombia',
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200',
    description: 'Conjunto residencial con vista panorámica',
    towers: ['Torre A', 'Torre B', 'Torre C'],
  });

  const orgAdmin = await User.create({
    email: 'admin@torresdelparque.co',
    passwordHash,
    firstName: 'María',
    lastName: 'González',
    phone: '+57 310 987 6543',
    role: 'ORG_ADMIN',
    organizationId: org._id,
  });

  const units = await Unit.insertMany([
    { organizationId: org._id, buildingId: building._id, number: '402', tower: 'Torre B', floor: 4, adminStatus: 'current' },
    { organizationId: org._id, buildingId: building._id, number: '701', tower: 'Torre A', floor: 7, adminStatus: 'current' },
    { organizationId: org._id, buildingId: building._id, number: '1203', tower: 'Torre C', floor: 12, adminStatus: 'pending' },
  ]);

  const residentUser = await User.create({
    email: 'residente@demo.co',
    passwordHash,
    firstName: 'Carlos',
    lastName: 'Ramírez',
    phone: '+57 320 555 1234',
    role: 'RESIDENT',
    organizationId: org._id,
  });

  await Resident.create({
    userId: residentUser._id,
    organizationId: org._id,
    unitId: units[0]._id,
    relationship: 'owner',
    moveInDate: new Date('2024-03-01'),
    isPrimary: true,
  });

  const categories = await ServiceCategory.insertMany(SERVICE_CATEGORIES);
  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

  const providerUser = await User.create({
    email: 'plomero@demo.co',
    passwordHash,
    firstName: 'Jorge',
    lastName: 'Martínez',
    phone: '+57 315 444 7788',
    role: 'PROVIDER',
    organizationId: org._id,
  });

  const provider = await ServiceProvider.create({
    userId: providerUser._id,
    organizationId: org._id,
    businessName: 'Plomería JM',
    categoryIds: [categoryBySlug.plomeria._id, categoryBySlug.instaladores._id],
    description: 'Servicio de plomería e instalaciones certificado',
    rating: 4.8,
    reviewCount: 24,
    isVerified: true,
  });

  await Service.insertMany([
    {
      organizationId: org._id,
      buildingId: building._id,
      categoryId: categoryBySlug.plomeria._id,
      providerId: provider._id,
      title: 'Plomería',
      description: 'Reparaciones urgentes',
      icon: 'wrench',
      priceFrom: 45000,
      sortOrder: 1,
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      categoryId: categoryBySlug.aseo._id,
      title: 'Aseo',
      description: 'Limpieza profunda',
      icon: 'sparkles',
      priceFrom: 80000,
      sortOrder: 2,
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      categoryId: categoryBySlug.gimnasio._id,
      title: 'Gimnasio',
      description: 'Reserva tu horario',
      icon: 'dumbbell',
      sortOrder: 5,
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      categoryId: categoryBySlug['salon-social']._id,
      title: 'Salón Social',
      description: 'Eventos familiares',
      icon: 'users',
      sortOrder: 6,
    },
  ]);

  await Facility.insertMany([
    {
      organizationId: org._id,
      buildingId: building._id,
      name: 'Gimnasio',
      slug: 'gimnasio',
      description: 'Gimnasio equipado con horario extendido',
      icon: 'dumbbell',
      capacity: 15,
      requiresApproval: false,
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      name: 'Salón Social',
      slug: 'salon-social',
      description: 'Salón para eventos de hasta 40 personas',
      icon: 'users',
      capacity: 40,
      requiresApproval: true,
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      name: 'BBQ Zone',
      slug: 'bbq-zone',
      description: 'Zona de asados en terraza',
      icon: 'flame',
      capacity: 20,
      requiresApproval: true,
    },
  ]);

  await Announcement.insertMany([
    {
      organizationId: org._id,
      buildingId: building._id,
      title: 'Yoga en la terraza',
      body: 'Clase gratuita los sábados a las 8:00 AM',
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600',
      type: 'experience',
      location: 'Terraza Torre B',
      eventAt: new Date('2026-06-14T13:00:00.000Z'),
      isFeatured: true,
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      title: 'Mantenimiento ascensores',
      body: 'Torre A — sábado 8 AM a 12 PM',
      type: 'announcement',
      isFeatured: true,
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      title: 'Feria del barrio',
      body: 'Artesanías y comida local este domingo',
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600',
      type: 'promotion',
      location: 'Parque central',
      price: 0,
      isFeatured: true,
    },
  ]);

  await QuickAction.insertMany([
    {
      buildingId: building._id,
      type: 'wifi',
      label: 'WiFi',
      icon: 'wifi',
      payload: { ssid: 'TorresDelParque_Guest', password: 'Bienvenido2026' },
      sortOrder: 1,
    },
    {
      buildingId: building._id,
      type: 'location',
      label: 'Ubicación',
      icon: 'map-pin',
      payload: { url: 'https://maps.google.com/?q=Torres+del+Parque+Bogota' },
      sortOrder: 2,
    },
    {
      buildingId: building._id,
      type: 'order',
      label: 'Pedir algo',
      icon: 'shopping-bag',
      payload: { message: 'Solicitud rápida de servicio' },
      sortOrder: 3,
    },
    {
      buildingId: building._id,
      type: 'whatsapp',
      label: 'Portería',
      icon: 'message-circle',
      payload: { phone: '573001234567', message: 'Hola, soy residente del conjunto' },
      sortOrder: 4,
    },
  ]);

  await EmergencyContact.insertMany([
    {
      buildingId: building._id,
      label: 'Portería 24/7',
      type: 'security',
      phone: '+57 601 555 0100',
      available24h: true,
      priority: 1,
    },
    {
      buildingId: building._id,
      label: 'Administración',
      type: 'admin',
      phone: '+57 300 123 4567',
      available24h: false,
      priority: 2,
    },
    {
      buildingId: building._id,
      label: 'Emergencias',
      type: 'emergency',
      phone: '123',
      available24h: true,
      priority: 0,
    },
  ]);

  console.log('\n✓ Seed completado\n');
  console.log('Colecciones creadas:');
  console.log('  organizations, buildings, units, users, residents');
  console.log('  service_categories, service_providers, services');
  console.log('  facilities, announcements, quick_actions, emergency_contacts');
  console.log('\nUsuarios demo (password: Rentados2026!):');
  console.log(`  Super Admin:  ${superAdmin.email}`);
  console.log(`  Org Admin:    ${orgAdmin.email}`);
  console.log(`  Residente:    ${residentUser.email}`);
  console.log(`  Prestador:    ${providerUser.email}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
