# Rentados Backend

API REST para la plataforma **Rentados** — gestión de conjuntos residenciales, residentes, administraciones y prestadores de servicios.

## Documentación

Ver [BLUEPRINT.md](./BLUEPRINT.md) para arquitectura completa, modelos de datos y roadmap.

## Requisitos

- Node.js 20+
- MongoDB Atlas (database: `rentados`)

## Setup local

```bash
cp .env.example .env
# Editar .env con tu MONGO_URI

npm install
npm run seed    # crea colecciones y datos iniciales
npm run dev     # servidor con hot reload
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1` | Info de la API |
| GET | `/api/v1/collections` | Resumen de colecciones (conteos) |

## Deploy

- **Producción:** https://rentados-backend.onrender.com
- **Repo:** https://github.com/bryanvisballara/rentados-backend

Configurar en Render: `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN`.
