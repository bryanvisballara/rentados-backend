# Rentados — Blueprint de Producto y Arquitectura

> Plataforma multi-tenant para administraciones de edificios y conjuntos residenciales en Colombia.

---

## 1. Visión

Rentados conecta **administraciones**, **residentes** y **prestadores de servicios** en un ecosistema digital. Cuatro portales comparten un backend único con control de acceso por rol y datos aislados por organización (tenant).

| Portal | Usuario | Propósito |
|--------|---------|-----------|
| **Super Admin** | Equipo Rentados | Gestionar tenants, planes, métricas globales, soporte |
| **Administración** | Administradores de edificio/conjunto | Unidades, residentes, reglas, anuncios, proveedores aprobados |
| **Prestadores** | Plomeros, aseo, instaladores, carpinteros… | Recibir solicitudes, agenda, historial, pagos |
| **Residentes** | Propietarios / arrendatarios | Home inspirado en CASA YATI: servicios, reservas, mensajes, emergencias |

---

## 2. Inspiración UI — Portal Residentes

Basado en el mockup de referencia (hero con foto del conjunto, acciones rápidas, grid de servicios, carrusel de experiencias, barra SOS, bottom nav).

### 2.1 Pantallas principales

```
┌─────────────────────────────────────┐
│  [Logo conjunto]          🔔        │
│  ─── Hero (foto edificio) ───       │
│  Hola, {nombre}                     │
│  ┌─────────────────────────────┐    │
│  │ Apto 402 • Torre B • Al día │    │
│  └─────────────────────────────┘    │
│  [WiFi] [Ubicación] [Pedir] [Chat]  │
│                                     │
│  Servicios & Reservas    Ver todos →│
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐               │
│  │  │ │  │ │  │ │  │  (grid 2×4)   │
│  └──┘ └──┘ └──┘ └──┘               │
│                                     │
│  Experiencias destacadas            │
│  ← [ card ] [ card ] [ card ] →     │
│                                     │
│  ┌──────── Ayuda 24/7 │ SOS ──────┐ │
│  └─────────────────────────────────┘│
│  Inicio | Reservas | Exp | Msg | Yo │
└─────────────────────────────────────┘
```

### 2.2 Mapeo funcional

| Elemento UI | Feature Rentados |
|-------------|------------------|
| Status card (habitación) | Unidad asignada + estado administración |
| WiFi | Credenciales del conjunto (config admin) |
| Ubicación | Mapa / guía del apartamento en el conjunto |
| Pedir algo | Solicitud rápida de servicio |
| Hablar con | WhatsApp / chat con portería o administración |
| Grid servicios | Categorías: plomería, aseo, carpintería, gimnasio, salón social… |
| Experiencias | Anuncios, eventos comunitarios, promociones locales |
| Barra inferior SOS | Contactos de emergencia del conjunto |
| Bottom nav | Inicio · Reservas · Experiencias · Mensajes · Perfil |

---

## 3. Arquitectura técnica

```
                    ┌──────────────────┐
                    │   Super Admin    │
                    │   (Web React)    │
                    └────────┬─────────┘
                             │
┌──────────────┐  ┌──────────┴──────────┐  ┌──────────────┐
│ Admin Web    │  │   rentados-backend   │  │ Prestadores  │
│ (React)      ├──┤   Node + Express     ├──┤ App / Web    │
└──────────────┘  │   MongoDB Atlas      │  └──────────────┘
                  │   JWT + RBAC         │
┌──────────────┐  │   Multi-tenant       │  ┌──────────────┐
│ Residentes   ├──┤                      ├──┤ Notificaciones│
│ (React Native│  └──────────┬───────────┘  │ FCM / Email  │
│  o Expo)     │             │              └──────────────┘
└──────────────┘             │
                    ┌────────┴────────┐
                    │  Render (API)   │
                    │  MongoDB Atlas  │
                    └─────────────────┘
```

### 3.1 Stack inicial (Fase 0 — este repo)

| Capa | Tecnología |
|------|------------|
| API | Node.js 20, Express 4 |
| ODM | Mongoose 8 |
| DB | MongoDB Atlas (`rentados` database) |
| Deploy | Render — `https://rentados-backend.onrender.com` |
| Auth (Fase 1) | JWT + bcrypt, roles enum |
| Validación (Fase 1) | Zod o express-validator |

### 3.2 Multi-tenancy

- Cada **Organization** = una administración (cliente B2B).
- Un **Building** pertenece a una organization.
- **Units**, **Residents**, **Services**, **Announcements** llevan `organizationId` (+ `buildingId` cuando aplique).
- Super admin ve todo; admin de org solo su tenant; residente solo su unidad; prestador solo solicitudes asignadas.

### 3.3 Roles (`UserRole`)

```
SUPER_ADMIN   → plataforma Rentados
ORG_ADMIN     → administrador del conjunto
ORG_STAFF     → portería, contabilidad
RESIDENT      → propietario / arrendatario
PROVIDER      → prestador de servicios externo
```

---

## 4. Modelo de datos (MongoDB)

### 4.1 Colecciones iniciales (Fase 0)

| Colección | Descripción | Índices clave |
|-----------|-------------|---------------|
| `organizations` | Administraciones clientes | `slug` unique |
| `buildings` | Edificios / conjuntos | `organizationId`, `slug` |
| `units` | Apartamentos | `buildingId`, `number` unique per building |
| `users` | Todos los usuarios | `email` unique, `role`, `organizationId` |
| `residents` | Perfil residente ↔ unidad | `userId`, `unitId` |
| `service_categories` | Plomería, aseo, gimnasio… | `slug` unique |
| `service_providers` | Prestadores registrados | `organizationId`, `categoryIds` |
| `services` | Servicios ofrecidos en el grid | `organizationId`, `categoryId` |
| `service_requests` | Solicitudes de residentes | `status`, `residentId`, `providerId` |
| `facilities` | Áreas comunes reservables | `buildingId`, `slug` |
| `facility_bookings` | Reservas de áreas comunes | `facilityId`, `startAt` |
| `announcements` | Anuncios / experiencias destacadas | `organizationId`, `publishedAt` |
| `messages` | Chat interno | `conversationId`, `createdAt` |
| `quick_actions` | WiFi, WhatsApp portería, etc. | `buildingId` |
| `emergency_contacts` | SOS del conjunto | `buildingId`, `priority` |

### 4.2 Estados principales

**ServiceRequest.status:** `pending` → `assigned` → `in_progress` → `completed` | `cancelled`

**FacilityBooking.status:** `pending` → `confirmed` → `cancelled`

**Unit.adminStatus:** `current` | `pending` | `overdue`

---

## 5. API — Roadmap de endpoints

### Fase 0 (actual)
- `GET /health` — health check Render
- `GET /api/v1` — info de versión
- `POST /api/v1/seed` — solo dev (deshabilitado en prod)

### Fase 1 — Auth & core
```
POST   /api/v1/auth/login
POST   /api/v1/auth/register-resident
GET    /api/v1/me

GET    /api/v1/organizations          (super admin)
GET    /api/v1/buildings/:id
GET    /api/v1/units/me               (residente)
```

### Fase 2 — Portal residente (home)
```
GET    /api/v1/resident/home           → hero, status, quick actions, grid, featured
GET    /api/v1/services?buildingId=
POST   /api/v1/service-requests
GET    /api/v1/announcements/featured
GET    /api/v1/emergency-contacts
```

### Fase 3 — Prestadores & admin
```
GET    /api/v1/provider/requests
PATCH  /api/v1/provider/requests/:id/status
CRUD   /api/v1/admin/units
CRUD   /api/v1/admin/announcements
POST   /api/v1/admin/facility-bookings/:id/approve
```

---

## 6. Portales — funcionalidades por fase

### Super Admin
- [ ] CRUD organizations + planes
- [ ] Dashboard: tenants activos, MRR, tickets soporte
- [ ] Impersonación segura (audit log)

### Administración
- [ ] Configurar edificio (fotos hero, WiFi, contactos)
- [ ] Gestionar unidades y residentes
- [ ] Aprobar prestadores
- [ ] Publicar anuncios y reglas
- [ ] Reportes de morosidad y solicitudes

### Prestadores
- [ ] Registro y verificación por admin
- [ ] Bandeja de solicitudes
- [ ] Calendario y disponibilidad
- [ ] Historial y calificaciones

### Residentes
- [ ] Home (mockup CASA YATI)
- [ ] Reservar áreas comunes
- [ ] Solicitar servicios
- [ ] Mensajes con admin/portería
- [ ] Botón emergencia

---

## 7. Infraestructura y deploy

| Recurso | Valor |
|---------|-------|
| Repositorio | `github.com/bryanvisballara/rentados-backend` |
| API producción | `https://rentados-backend.onrender.com` |
| Render Service ID | `srv-d8iapqjtqb8s73av95d0` |
| Base de datos | MongoDB Atlas — database `rentados` |

### Variables de entorno (Render)

```
NODE_ENV=production
PORT=10000
MONGO_URI=<mongodb+srv://...>
JWT_SECRET=<generar-secreto-largo>
CORS_ORIGIN=https://app.rentados.co
```

> **Seguridad:** nunca commitear `MONGO_URI` ni webhook keys. Usar `.env` local y dashboard de Render.

---

## 8. Próximos pasos recomendados

1. **Fase 1:** Auth JWT + middleware RBAC + login por portal
2. **Fase 2:** Endpoint `GET /resident/home` agregando datos del mockup
3. **Fase 3:** App móvil Expo con bottom navigation del diseño
4. **Fase 4:** Integración WhatsApp Business API para "Hablar con portería"
5. **Fase 5:** Pasarela de pagos (administración / servicios)

---

## 9. Estructura del repositorio

```
rentados-backend/
├── BLUEPRINT.md          ← este documento
├── README.md
├── package.json
├── render.yaml
├── .env.example
├── src/
│   ├── index.js          ← entry + Express
│   ├── config/db.js
│   ├── models/           ← schemas Mongoose
│   ├── routes/
│   └── scripts/seed.js   ← colecciones + datos iniciales
└── .gitignore
```

---

*Documento vivo — actualizar en cada fase del producto.*
