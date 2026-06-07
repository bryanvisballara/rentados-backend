require('dotenv').config();

const bcrypt = require('bcryptjs');
const { connectDB } = require('../config/db');
const {
  User,
  Organization,
  Building,
  Tower,
  Unit,
  Resident,
  ServiceCategory,
  ServiceProvider,
  Service,
  Facility,
  ServiceSuspension,
  Announcement,
  Publication,
  Payment,
  VisitorParking,
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

async function runSeed() {
  await connectDB();

  console.log('Limpiando colecciones existentes…');
  await Promise.all([
    User.deleteMany({}),
    Organization.deleteMany({}),
    Building.deleteMany({}),
    Tower.deleteMany({}),
    Unit.deleteMany({}),
    Resident.deleteMany({}),
    ServiceCategory.deleteMany({}),
    ServiceProvider.deleteMany({}),
    Service.deleteMany({}),
    Facility.deleteMany({}),
    ServiceSuspension.deleteMany({}),
    Announcement.deleteMany({}),
    Publication.deleteMany({}),
    Payment.deleteMany({}),
    VisitorParking.deleteMany({}),
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
    name: 'Administración Paraíso Caribe',
    slug: 'paraiso-caribe',
    nit: '900123456-1',
    email: 'contacto@paraisocaribe.com',
    phone: '+57 300 123 4567',
    plan: 'pro',
    settings: {
      billing: {
        monthlyInterestRatePercent: 1.5,
        gracePeriodDays: 5,
        maxInterestMonths: 12,
        autoSuggestSuspensionOnOverdue: true,
      },
    },
  });

  const building = await Building.create({
    organizationId: org._id,
    name: 'Conjunto Paraíso Caribe',
    slug: 'paraiso-caribe',
    address: {
      street: 'Conjunto Paraíso Caribe',
      city: 'Cartagena',
      state: 'Bolívar',
      country: 'Colombia',
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200',
    description: 'Conjunto residencial frente al mar',
    towers: ['Torre A', 'Torre B', 'Torre C'],
  });

  const orgAdmin = await User.create({
    email: 'admin@paraisocaribe.com',
    passwordHash,
    firstName: 'Bryan',
    lastName: 'Visbal',
    phone: '+57 310 987 6543',
    role: 'ORG_ADMIN',
    organizationId: org._id,
  });

  const towers = await Tower.insertMany([
    { organizationId: org._id, buildingId: building._id, name: 'Torre A', code: 'A', floors: 15, sortOrder: 1 },
    { organizationId: org._id, buildingId: building._id, name: 'Torre B', code: 'B', floors: 12, sortOrder: 2 },
    { organizationId: org._id, buildingId: building._id, name: 'Torre C', code: 'C', floors: 18, sortOrder: 3 },
  ]);

  const porteriaUser = await User.create({
    email: 'porteria@paraisocaribe.com',
    passwordHash,
    firstName: 'Luis',
    lastName: 'Vargas',
    phone: '+57 311 222 3344',
    role: 'ORG_STAFF',
    staffType: 'porteria',
    organizationId: org._id,
    buildingId: building._id,
  });

  const units = await Unit.insertMany([
    {
      organizationId: org._id,
      buildingId: building._id,
      towerId: towers[1]._id,
      number: '402',
      tower: 'Torre B',
      floor: 4,
      type: 'apartment',
      adminStatus: 'current',
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      towerId: towers[0]._id,
      number: '701',
      tower: 'Torre A',
      floor: 7,
      type: 'apartment',
      adminStatus: 'current',
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      towerId: towers[2]._id,
      number: '1203',
      tower: 'Torre C',
      floor: 12,
      type: 'apartment',
      adminStatus: 'overdue',
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      number: 'Casa 12',
      type: 'house',
      adminStatus: 'pending',
    },
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

  await Payment.insertMany([
    {
      organizationId: org._id,
      unitId: units[0]._id,
      concept: 'administration',
      period: '2026-05',
      amount: 420000,
      paidAmount: 420000,
      dueDate: new Date('2026-05-05'),
      paidAt: new Date('2026-05-03'),
      status: 'paid',
    },
    {
      organizationId: org._id,
      unitId: units[0]._id,
      concept: 'administration',
      period: '2026-06',
      amount: 420000,
      paidAmount: 420000,
      dueDate: new Date('2026-06-05'),
      paidAt: new Date('2026-06-02'),
      status: 'paid',
    },
    {
      organizationId: org._id,
      unitId: units[2]._id,
      concept: 'administration',
      period: '2026-06',
      amount: 510000,
      paidAmount: 0,
      dueDate: new Date('2026-06-05'),
      status: 'overdue',
    },
    {
      organizationId: org._id,
      unitId: units[3]._id,
      concept: 'administration',
      period: '2026-06',
      amount: 680000,
      paidAmount: 0,
      dueDate: new Date('2026-06-10'),
      status: 'pending',
    },
  ]);

  await VisitorParking.insertMany([
    { organizationId: org._id, buildingId: building._id, spotNumber: 'V-01', zone: 'Entrada principal', label: 'Visitante 1' },
    { organizationId: org._id, buildingId: building._id, spotNumber: 'V-02', zone: 'Entrada principal', label: 'Visitante 2', isOccupied: true },
    { organizationId: org._id, buildingId: building._id, spotNumber: 'V-03', zone: 'Sótano', label: 'Visitante 3' },
  ]);

  await Publication.create({
    organizationId: org._id,
    buildingId: building._id,
    title: 'Bienvenida junio',
    body: 'Recordatorio de horarios de zonas comunes.',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
      },
    ],
    createdBy: orgAdmin._id,
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

  const facilities = await Facility.insertMany([
    {
      organizationId: org._id,
      buildingId: building._id,
      name: 'Gimnasio',
      slug: 'gimnasio',
      description: 'Gimnasio equipado con horario extendido',
      icon: 'dumbbell',
      capacity: 15,
      price: 35000,
      pricingType: 'monthly',
      blockWhenOverdue: true,
      requiresApproval: false,
      openHours: { start: '05:30', end: '21:00' },
      seasonOpenDate: new Date('2026-01-01'),
      seasonCloseDate: new Date('2026-12-31'),
      status: 'open',
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      name: 'Salón Social',
      slug: 'salon-social',
      description: 'Salón para eventos de hasta 40 personas',
      icon: 'users',
      capacity: 40,
      price: 180000,
      pricingType: 'per_use',
      blockWhenOverdue: true,
      requiresApproval: true,
      openHours: { start: '08:00', end: '22:00' },
      seasonOpenDate: new Date('2026-01-01'),
      seasonCloseDate: new Date('2026-12-31'),
      status: 'open',
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      name: 'Piscina',
      slug: 'piscina',
      description: 'Piscina climatizada',
      icon: 'waves',
      capacity: 30,
      price: 0,
      pricingType: 'free',
      blockWhenOverdue: true,
      requiresApproval: false,
      openHours: { start: '07:00', end: '20:00' },
      seasonOpenDate: new Date('2026-03-01'),
      seasonCloseDate: new Date('2026-11-30'),
      status: 'open',
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      name: 'BBQ Zone',
      slug: 'bbq-zone',
      description: 'Zona de asados en terraza',
      icon: 'flame',
      capacity: 20,
      price: 85000,
      pricingType: 'per_use',
      blockWhenOverdue: false,
      requiresApproval: true,
      openHours: { start: '10:00', end: '22:00' },
      status: 'maintenance',
      maintenanceClosures: [
        {
          startAt: new Date('2026-06-01'),
          endAt: new Date('2026-06-15'),
          reason: 'Mantenimiento de gas',
          isActive: true,
        },
      ],
    },
  ]);

  const morosoUser = await User.create({
    email: 'moroso@demo.co',
    passwordHash,
    firstName: 'Ana',
    lastName: 'Torres',
    phone: '+57 318 777 8899',
    role: 'RESIDENT',
    organizationId: org._id,
  });

  await Resident.create({
    userId: morosoUser._id,
    organizationId: org._id,
    unitId: units[2]._id,
    relationship: 'owner',
    moveInDate: new Date('2023-08-01'),
    isPrimary: true,
  });

  await ServiceSuspension.create({
    organizationId: org._id,
    unitId: units[2]._id,
    facilityIds: [facilities[0]._id, facilities[2]._id],
    startAt: new Date('2026-06-01'),
    endAt: new Date('2026-06-30'),
    reason: 'morosidad',
    notes: 'Suspensión gimnasio y piscina por mora junio 2026',
    createdBy: orgAdmin._id,
  });

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
      payload: { ssid: 'ParaisoCaribe_Guest', password: 'Bienvenido2026' },
      sortOrder: 1,
    },
    {
      buildingId: building._id,
      type: 'location',
      label: 'Ubicación',
      icon: 'map-pin',
      payload: { url: 'https://maps.google.com/?q=Paraiso+Caribe+Cartagena' },
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
  console.log('  facilities, publications, payments, visitor_parking');
  console.log('  announcements, quick_actions, emergency_contacts');
  console.log('\nUsuarios demo (password: Rentados2026!):');
  console.log(`  Super Admin:  ${superAdmin.email}`);
  console.log(`  Org Admin:    ${orgAdmin.email}`);
  console.log(`  Portería:     ${porteriaUser.email}`);
  console.log(`  Residente:    ${residentUser.email}`);
  console.log(`  Moroso demo:  ${morosoUser.email}`);
  console.log(`  Prestador:    ${providerUser.email}`);

  return { superAdmin, orgAdmin, porteriaUser, residentUser, morosoUser, providerUser };
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error en seed:', err);
      process.exit(1);
    });
}

module.exports = { runSeed };
