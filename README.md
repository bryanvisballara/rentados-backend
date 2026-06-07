# Rentados

Plataforma para administración de conjuntos residenciales — API, panel admin y portal de residentes.

## Requisitos

- Node.js 20+
- MongoDB Atlas (database: `rentados`)

## Desarrollo local

```bash
cp .env.example .env
npm install
npm --prefix web install
npm run db:sync
npm run dev:all
```

- Frontend local: http://localhost:5174
- API local: http://localhost:3000

## Producción (Render + MongoDB Atlas)

**URL:** https://rentados-backend.onrender.com  
**Repo:** https://github.com/bryanvisballara/rentados-backend

### Variables en Render

| Variable | Descripción |
|----------|-------------|
| `MONGO_URI` | Connection string Atlas → database `rentados` |
| `JWT_SECRET` | Secreto para tokens |
| `CORS_ORIGIN` | `https://rentados-backend.onrender.com` |
| `RUN_DB_SYNC` | `true` → sincroniza MongoDB en cada deploy (build) |
| `DEPLOY_KEY` | Secreto para `POST /api/v1/deploy/sync-db` |

### Deploy

Cada push a `main` despliega en Render. Si `RUN_DB_SYNC=true`, el build ejecuta `npm run db:sync` contra Atlas.

Sync manual remoto:

```bash
curl -X POST https://rentados-backend.onrender.com/api/v1/deploy/sync-db \
  -H "x-deploy-key: TU_DEPLOY_KEY"
```

Sync manual local (misma base Atlas):

```bash
npm run db:sync
```

## Login admin demo

- URL: `/admin/login`
- Email: `admin@paraisocaribe.com`
- Password: `Rentados2026!`

Ver [BLUEPRINT.md](./BLUEPRINT.md) para arquitectura completa.
