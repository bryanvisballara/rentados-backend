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
  FacilityBooking,
  ServiceSuspension,
  Announcement,
  Publication,
  Payment,
  VisitorParking,
  LockerPackage,
  ResidentNotification,
  VisitorParkingVisit,
  QuickAction,
  EmergencyContact,
  ProviderInterview,
  PlatformPublication,
  ShopCategory,
  ShopProduct,
  ShopOrder,
  UserSession,
  UnitAppFollowUp,
  Restaurant,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantOrder,
} = require('../models');
const { buildUnitCode } = require('../utils/unitCode');

function buildTowerUnitRows(organizationId, buildingId, tower, floorConfigs) {
  const rows = [];
  for (const { floor, aptCount } of floorConfigs) {
    for (let apt = 1; apt <= aptCount; apt += 1) {
      const aptSuffix = String(apt).padStart(2, '0');
      const number = `${floor}${aptSuffix}`;
      rows.push({
        organizationId,
        buildingId,
        towerId: tower._id,
        number,
        code: buildUnitCode({ towerCode: tower.code, floor, number }),
        tower: tower.name,
        floor,
        type: 'apartment',
        administrationFee: 420000,
        adminStatus: 'current',
      });
    }
  }
  return rows;
}

const SERVICE_CATEGORIES = [
  { name: 'Plomería', slug: 'plomeria', description: 'Reparaciones e instalaciones hidráulicas', icon: 'wrench', sortOrder: 1 },
  { name: 'Aseo', slug: 'aseo', description: 'Limpieza del apartamento', icon: 'sparkles', sortOrder: 2 },
  { name: 'Instaladores', slug: 'instaladores', description: 'Electricidad y gas', icon: 'zap', sortOrder: 3 },
  { name: 'Carpintería', slug: 'carpinteria', description: 'Muebles y reparaciones en madera', icon: 'hammer', sortOrder: 4 },
  { name: 'Mudanzas', slug: 'mudanzas', description: 'Autorización y apoyo en mudanza', icon: 'truck', sortOrder: 5 },
];

const SHOP_CATEGORIES = [
  { name: 'Cocina', slug: 'cocina', description: 'Utensilios y accesorios', icon: 'utensils', sortOrder: 1 },
  { name: 'Limpieza', slug: 'limpieza', description: 'Productos de aseo del hogar', icon: 'spray-can', sortOrder: 2 },
  { name: 'Organización', slug: 'organizacion', description: 'Orden y almacenamiento', icon: 'boxes', sortOrder: 3 },
  { name: 'Baño', slug: 'bano', description: 'Accesorios y cuidado del baño', icon: 'bath', sortOrder: 4 },
];

/** Paraíso Caribe: 3 torres · 12 pisos × 13 aptos = 156 por torre · 468 apartamentos + 1 casa. */
const DEMO_TOWER_COUNT = 3;
const DEMO_TOWER_FLOORS = Array.from({ length: 12 }, (_, index) => ({
  floor: index + 1,
  aptCount: 13,
}));

const DEMO_TOWER_DEFS = Array.from({ length: DEMO_TOWER_COUNT }, (_, index) => ({
  name: `Torre ${index + 1}`,
  code: String(index + 1),
  floors: 12,
  sortOrder: index + 1,
}));

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
    FacilityBooking.deleteMany({}),
    ServiceSuspension.deleteMany({}),
    Announcement.deleteMany({}),
    Publication.deleteMany({}),
    Payment.deleteMany({}),
    VisitorParking.deleteMany({}),
    LockerPackage.deleteMany({}),
    ResidentNotification.deleteMany({}),
    VisitorParkingVisit.deleteMany({}),
    QuickAction.deleteMany({}),
    EmergencyContact.deleteMany({}),
    ProviderInterview.deleteMany({}),
    PlatformPublication.deleteMany({}),
    ShopCategory.deleteMany({}),
    ShopProduct.deleteMany({}),
    ShopOrder.deleteMany({}),
    UserSession.deleteMany({}),
    UnitAppFollowUp.deleteMany({}),
    RestaurantOrder.deleteMany({}),
    RestaurantMenuItem.deleteMany({}),
    RestaurantMenuCategory.deleteMany({}),
    Restaurant.deleteMany({}),
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
        defaultAdministrationFee: 420000,
        autoSuggestSuspensionOnOverdue: true,
        autoSuspension: {
          enabled: false,
          facilityIds: [],
          durationDays: 30,
          autoLiftWhenPaid: true,
        },
      },
      locker: {
        enabled: true,
        receiveWhenOverdue: true,
        notifyWhenOverdue: true,
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
    towers: DEMO_TOWER_DEFS.map((tower) => tower.name),
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

  const towers = await Tower.insertMany(
    DEMO_TOWER_DEFS.map((tower) => ({
      organizationId: org._id,
      buildingId: building._id,
      name: tower.name,
      code: tower.code,
      floors: tower.floors,
      sortOrder: tower.sortOrder,
    }))
  );

  const towerUnits = towers.flatMap((tower) =>
    buildTowerUnitRows(org._id, building._id, tower, DEMO_TOWER_FLOORS)
  );

  const units = await Unit.insertMany([
    ...towerUnits,
    {
      organizationId: org._id,
      buildingId: building._id,
      number: 'Casa 12',
      type: 'house',
      administrationFee: 680000,
      adminStatus: 'pending',
    },
  ]);

  const residentUnit = units.find((u) => u.code === '1101');
  const overdueUnit = units.find((u) => u.code === '11203');
  const houseUnit = units.find((u) => u.number === 'Casa 12');

  if (overdueUnit) {
    overdueUnit.adminStatus = 'overdue';
    await overdueUnit.save();
  }

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
    unitId: residentUnit._id,
    relationship: 'owner',
    moveInDate: new Date('2024-03-01'),
    isPrimary: true,
  });
  const residentProfile = await Resident.findOne({ userId: residentUser._id });

  await Payment.insertMany([
    {
      organizationId: org._id,
      unitId: residentUnit._id,
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
      unitId: residentUnit._id,
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
      unitId: overdueUnit._id,
      concept: 'administration',
      period: '2026-06',
      amount: 510000,
      paidAmount: 0,
      dueDate: new Date('2026-06-05'),
      status: 'overdue',
    },
    {
      organizationId: org._id,
      unitId: houseUnit._id,
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
    approvalStatus: 'approved',
    isVerified: true,
    offerings: [
      {
        categoryId: categoryBySlug.plomeria._id,
        description: 'Reparaciones urgentes y mantenimiento preventivo',
        pricingNotes: 'Depende del daño, materiales y tamaño del apartamento',
        referencePrice: 45000,
      },
      {
        categoryId: categoryBySlug.instaladores._id,
        description: 'Instalaciones menores de plomería y gas',
        pricingNotes: 'Visita de diagnóstico desde $35.000',
        referencePrice: 35000,
      },
    ],
  });

  const pendingProviderUser = await User.create({
    email: 'electricista@demo.co',
    passwordHash,
    firstName: 'María',
    lastName: 'Gómez',
    phone: '+57 314 555 9900',
    role: 'PROVIDER',
  });

  await ServiceProvider.create({
    userId: pendingProviderUser._id,
    businessName: 'Electricidad MG',
    categoryIds: [categoryBySlug.instaladores._id],
    description: 'Instalaciones eléctricas residenciales',
    approvalStatus: 'pending',
    isVerified: false,
  });

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
      pricingType: 'per_block',
      blockWhenOverdue: true,
      requiresApproval: true,
      bookable: true,
      bookingPricing: {
        mode: 'blocks',
        blocks: [
          { label: '4 horas', durationMinutes: 240, price: 180000 },
          { label: '8 horas', durationMinutes: 480, price: 320000 },
        ],
      },
      bookingRules: {
        slotMinutes: 60,
        minDurationMinutes: 240,
        maxDurationMinutes: 480,
        advanceBookingDays: 30,
      },
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
      price: 45000,
      pricingType: 'per_hour',
      blockWhenOverdue: false,
      requiresApproval: false,
      bookable: true,
      bookingPricing: {
        mode: 'hourly',
        hourlyRate: 45000,
        blocks: [],
      },
      bookingRules: {
        slotMinutes: 60,
        minDurationMinutes: 120,
        maxDurationMinutes: 360,
        advanceBookingDays: 14,
      },
      openHours: { start: '10:00', end: '22:00' },
      status: 'open',
    },
    {
      organizationId: org._id,
      buildingId: building._id,
      name: 'Sauna',
      slug: 'sauna',
      description: 'Sauna seca — reserva por paquetes de 2 horas',
      icon: 'thermometer',
      capacity: 6,
      price: 60000,
      pricingType: 'per_block',
      blockWhenOverdue: true,
      requiresApproval: false,
      bookable: true,
      bookingPricing: {
        mode: 'blocks',
        blocks: [{ label: '2 horas', durationMinutes: 120, price: 60000 }],
      },
      bookingRules: {
        slotMinutes: 60,
        minDurationMinutes: 120,
        maxDurationMinutes: 120,
        advanceBookingDays: 7,
      },
      openHours: { start: '07:00', end: '21:00' },
      status: 'open',
    },
  ]);

  const bookingStart = new Date();
  bookingStart.setDate(bookingStart.getDate() + ((8 - bookingStart.getDay()) % 7 || 7));
  bookingStart.setHours(14, 0, 0, 0);
  const bookingEnd = new Date(bookingStart.getTime() + 4 * 60 * 60000);

  await FacilityBooking.create({
    organizationId: org._id,
    buildingId: building._id,
    facilityId: facilities[1]._id,
    residentId: residentProfile._id,
    unitId: residentUnit._id,
    startAt: bookingStart,
    endAt: bookingEnd,
    durationMinutes: 240,
    totalPrice: 180000,
    currency: 'COP',
    pricingMode: 'blocks',
    pricingLabel: '4 horas',
    status: 'confirmed',
    notes: 'Cumpleaños familiar',
  });

  const bbqStart = new Date(bookingStart);
  bbqStart.setDate(bbqStart.getDate() + 1);
  bbqStart.setHours(11, 0, 0, 0);
  const bbqEnd = new Date(bbqStart.getTime() + 3 * 60 * 60000);

  await FacilityBooking.create({
    organizationId: org._id,
    buildingId: building._id,
    facilityId: facilities[3]._id,
    residentId: residentProfile._id,
    unitId: residentUnit._id,
    startAt: bbqStart,
    endAt: bbqEnd,
    durationMinutes: 180,
    totalPrice: 135000,
    currency: 'COP',
    pricingMode: 'hourly',
    status: 'confirmed',
  });

  org.settings.billing.autoSuspension = {
    enabled: true,
    facilityIds: [facilities[0]._id.toString(), facilities[2]._id.toString()],
    durationDays: 30,
    autoLiftWhenPaid: true,
  };
  org.markModified('settings.billing');
  await org.save();

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
    unitId: overdueUnit._id,
    relationship: 'owner',
    moveInDate: new Date('2023-08-01'),
    isPrimary: true,
  });

  await ServiceSuspension.create({
    organizationId: org._id,
    unitId: overdueUnit._id,
    facilityIds: [facilities[0]._id, facilities[2]._id],
    startAt: new Date('2026-06-01'),
    endAt: new Date('2026-06-30'),
    reason: 'morosidad',
    notes: 'Suspensión manual por mora junio 2026',
    isAutomatic: false,
    createdBy: orgAdmin._id,
  });

  const { syncAutoSuspensions } = require('../utils/autoSuspension');
  await syncAutoSuspensions(org, { userId: orgAdmin._id });

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

  const shopCategories = await ShopCategory.insertMany(SHOP_CATEGORIES);
  const shopCategoryBySlug = Object.fromEntries(shopCategories.map((c) => [c.slug, c._id]));

  const shopProducts = await ShopProduct.insertMany([
    {
      name: 'Set ollas antiadherentes 5 pzas',
      slug: 'set-ollas-antiadherentes',
      shortDescription: 'Ideal para cocina diaria en apartamento',
      description: 'Juego de 5 piezas con tapa de vidrio. Compatible con cocinas de inducción y gas.',
      categoryId: shopCategoryBySlug.cocina,
      price: 189900,
      compareAtPrice: 249900,
      sku: 'COC-OLL-001',
      stock: 24,
      images: [{ url: 'https://images.unsplash.com/photo-1584990342414-102c722a9227?w=600', sortOrder: 0 }],
      targetCountries: ['Colombia'],
      targetCities: ['Cartagena'],
      isFeatured: true,
      sortOrder: 1,
      createdBy: superAdmin._id,
    },
    {
      name: 'Kit limpieza multiusos',
      slug: 'kit-limpieza-multiusos',
      shortDescription: 'Desinfectante, trapeador y paños microfibra',
      description: 'Todo lo necesario para el aseo semanal del apartamento.',
      categoryId: shopCategoryBySlug.limpieza,
      price: 45900,
      sku: 'LIM-KIT-001',
      stock: 40,
      images: [{ url: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69bb?w=600', sortOrder: 0 }],
      targetCountries: ['Colombia'],
      isFeatured: true,
      sortOrder: 2,
      createdBy: superAdmin._id,
    },
    {
      name: 'Organizador modular 6 cajones',
      slug: 'organizador-modular-6',
      shortDescription: 'Para closet o lavandería',
      description: 'Estructura plástica resistente, fácil de armar.',
      categoryId: shopCategoryBySlug.organizacion,
      price: 129900,
      compareAtPrice: 149900,
      sku: 'ORG-MOD-006',
      stock: 15,
      images: [{ url: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=600', sortOrder: 0 }],
      sortOrder: 3,
      createdBy: superAdmin._id,
    },
    {
      name: 'Set toallas premium x3',
      slug: 'set-toallas-premium',
      shortDescription: 'Algodón 500 gsm',
      description: 'Tres tamaños: manos, rostro y cuerpo.',
      categoryId: shopCategoryBySlug.bano,
      price: 79900,
      sku: 'BAN-TOW-003',
      stock: 30,
      images: [{ url: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=600', sortOrder: 0 }],
      targetCountries: ['Colombia'],
      targetCities: ['Cartagena'],
      sortOrder: 4,
      createdBy: superAdmin._id,
    },
    {
      name: 'Dispensador jabón automático',
      slug: 'dispensador-jabon-automatico',
      shortDescription: 'Sensor infrarrojo, recargable USB',
      categoryId: shopCategoryBySlug.bano,
      price: 54900,
      sku: 'BAN-DSP-001',
      stock: 18,
      images: [{ url: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=600', sortOrder: 0 }],
      sortOrder: 5,
      createdBy: superAdmin._id,
    },
  ]);

  const kitProduct = shopProducts.find((p) => p.slug === 'kit-limpieza-multiusos');
  const ollasProduct = shopProducts.find((p) => p.slug === 'set-ollas-antiadherentes');

  await ShopOrder.insertMany([
    {
      orderNumber: 'SH-20260606-DEMO1',
      residentId: residentProfile._id,
      userId: residentUser._id,
      organizationId: org._id,
      buildingId: building._id,
      unitId: residentUnit._id,
      customerName: 'Carlos Ramírez',
      customerEmail: residentUser.email,
      customerPhone: residentUser.phone,
      buildingName: building.name,
      unitNumber: residentUnit.number,
      unitTower: residentUnit.tower,
      city: building.address.city,
      country: building.address.country,
      items: [
        {
          productId: kitProduct._id,
          name: kitProduct.name,
          sku: kitProduct.sku,
          imageUrl: kitProduct.images[0]?.url,
          quantity: 1,
          unitPrice: kitProduct.price,
          lineTotal: kitProduct.price,
          currency: 'COP',
        },
        {
          productId: ollasProduct._id,
          name: ollasProduct.name,
          sku: ollasProduct.sku,
          imageUrl: ollasProduct.images[0]?.url,
          quantity: 1,
          unitPrice: ollasProduct.price,
          lineTotal: ollasProduct.price,
          currency: 'COP',
        },
      ],
      subtotal: kitProduct.price + ollasProduct.price,
      currency: 'COP',
      notes: 'Entregar en portería Torre 1',
      status: 'pending',
    },
  ]);

  const rentadosKitchen = await Restaurant.create({
    name: 'Rentados Kitchen',
    slug: 'rentados-kitchen',
    shortDescription: 'Comida casera y saludable para el conjunto',
    description:
      'Restaurante propio de Rentados con menú pensado para residentes: bowls, platos del día y opciones ligeras.',
    cuisineType: 'Saludable · Colombiana',
    coverImage: {
      url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200',
    },
    city: 'Cartagena',
    country: 'Colombia',
    address: 'Operación central Rentados · entrega en conjuntos',
    phone: '+57 300 555 0101',
    email: 'kitchen@rentados.co',
    openingHours: 'Lun–Dom 11:00 – 21:30',
    deliveryFee: 4900,
    minOrderAmount: 25000,
    currency: 'COP',
    avgPrepMinutes: 35,
    targetCountries: ['Colombia'],
    targetCities: ['Cartagena'],
    isFeatured: true,
    sortOrder: 1,
    createdBy: superAdmin._id,
  });

  const menuCategories = await RestaurantMenuCategory.insertMany([
    {
      restaurantId: rentadosKitchen._id,
      name: 'Platos del día',
      slug: 'platos-del-dia',
      description: 'Opciones completas para almuerzo o cena',
      sortOrder: 1,
    },
    {
      restaurantId: rentadosKitchen._id,
      name: 'Bowls y ensaladas',
      slug: 'bowls-ensaladas',
      sortOrder: 2,
    },
    {
      restaurantId: rentadosKitchen._id,
      name: 'Bebidas',
      slug: 'bebidas',
      sortOrder: 3,
    },
  ]);

  const menuCategoryBySlug = Object.fromEntries(menuCategories.map((c) => [c.slug, c._id]));

  const menuItems = await RestaurantMenuItem.insertMany([
    {
      restaurantId: rentadosKitchen._id,
      categoryId: menuCategoryBySlug['platos-del-dia'],
      name: 'Bandeja paisa light',
      slug: 'bandeja-paisa-light',
      description: 'Frijol, arroz, huevo, aguacate y chicharrón al horno.',
      price: 28900,
      compareAtPrice: 32900,
      currency: 'COP',
      images: [{ url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600', sortOrder: 0 }],
      tags: ['popular'],
      isFeatured: true,
      sortOrder: 1,
    },
    {
      restaurantId: rentadosKitchen._id,
      categoryId: menuCategoryBySlug['bowls-ensaladas'],
      name: 'Bowl mediterráneo',
      slug: 'bowl-mediterraneo',
      description: 'Quinoa, hummus, pepino, tomate cherry y aceitunas.',
      price: 24900,
      currency: 'COP',
      images: [{ url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600', sortOrder: 0 }],
      tags: ['vegetariano'],
      sortOrder: 2,
    },
    {
      restaurantId: rentadosKitchen._id,
      categoryId: menuCategoryBySlug.bebidas,
      name: 'Limonada de coco',
      slug: 'limonada-de-coco',
      description: '500 ml · preparada al momento',
      price: 8900,
      currency: 'COP',
      sortOrder: 3,
    },
  ]);

  const bandejaItem = menuItems.find((item) => item.slug === 'bandeja-paisa-light');
  const bowlItem = menuItems.find((item) => item.slug === 'bowl-mediterraneo');

  await RestaurantOrder.insertMany([
    {
      orderNumber: 'RS-20260608-DEMO1',
      restaurantId: rentadosKitchen._id,
      restaurantName: rentadosKitchen.name,
      residentId: residentProfile._id,
      userId: residentUser._id,
      organizationId: org._id,
      buildingId: building._id,
      unitId: residentUnit._id,
      customerName: 'Carlos Ramírez',
      customerEmail: residentUser.email,
      customerPhone: residentUser.phone,
      buildingName: building.name,
      unitNumber: residentUnit.number,
      unitTower: residentUnit.tower,
      city: building.address.city,
      country: building.address.country,
      items: [
        {
          menuItemId: bandejaItem._id,
          name: bandejaItem.name,
          quantity: 1,
          unitPrice: bandejaItem.price,
          lineTotal: bandejaItem.price,
          currency: 'COP',
        },
        {
          menuItemId: bowlItem._id,
          name: bowlItem.name,
          quantity: 1,
          unitPrice: bowlItem.price,
          lineTotal: bowlItem.price,
          currency: 'COP',
        },
      ],
      subtotal: bandejaItem.price + bowlItem.price,
      deliveryFee: rentadosKitchen.deliveryFee,
      total: bandejaItem.price + bowlItem.price + rentadosKitchen.deliveryFee,
      currency: 'COP',
      notes: 'Sin cebolla en el bowl',
      status: 'confirmed',
    },
  ]);

  const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await UserSession.insertMany([
    {
      jti: 'seed-resident-session',
      userId: residentUser._id,
      organizationId: org._id,
      buildingId: building._id,
      role: 'RESIDENT',
      portal: 'resident',
      lastSeenAt: new Date(),
      expiresAt: sessionExpiry,
    },
    {
      jti: 'seed-porteria-session',
      userId: porteriaUser._id,
      organizationId: org._id,
      buildingId: building._id,
      role: 'ORG_STAFF',
      staffType: 'porteria',
      portal: 'porteria',
      lastSeenAt: new Date(),
      expiresAt: sessionExpiry,
    },
  ]);

  const demoFollowUpUnits = units.filter((unit) => ['1102', '1203'].includes(unit.code));
  if (demoFollowUpUnits.length) {
    await UnitAppFollowUp.insertMany(
      demoFollowUpUnits.map((unit, index) => ({
        organizationId: org._id,
        buildingId: building._id,
        unitId: unit._id,
        reason:
          index === 0
            ? 'No estaba en casa en la primera visita'
            : 'No tiene smartphone compatible',
        notes: index === 0 ? 'Agendar segunda visita el fin de semana.' : '',
        visitorName: 'Equipo adopción Rentados',
        createdBy: superAdmin._id,
      }))
    );
  }

  console.log('\n✓ Seed completado\n');
  console.log('Colecciones creadas:');
  console.log('  organizations, buildings, units, users, residents');
  console.log('  service_categories, service_providers, services');
  console.log('  facilities, publications, payments, visitor_parking');
  console.log('  announcements, quick_actions, emergency_contacts');
  console.log('  shop_categories, shop_products, shop_orders');
  console.log('  restaurants, restaurant_menu, restaurant_orders');
  console.log('\nUsuarios demo (password: Rentados2026!):');
  console.log(`  Super Admin:  ${superAdmin.email} → /super-admin/login`);
  console.log(`  Org Admin:    ${orgAdmin.email}`);
  console.log(`  Portería:     ${porteriaUser.email}`);
  console.log(`  Residente:    ${residentUser.email}`);
  console.log(`  Moroso demo:  ${morosoUser.email}`);
  console.log(`  Prestador:    ${providerUser.email}`);
  console.log(`  Aspirante:    ${pendingProviderUser.email} (solicitud pendiente)`);

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
