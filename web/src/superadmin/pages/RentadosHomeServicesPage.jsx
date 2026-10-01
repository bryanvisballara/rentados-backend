import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { platformApi } from '../../api/client';
import '../../admin/admin.css';

const emptyForm = {
  name: '',
  description: '',
  slug: '',
  sortOrder: '',
};

const DRAG_MIME = 'application/x-rentados-service-id';

function reorderServices(list, draggedId, targetId) {
  if (!draggedId || draggedId === targetId) return list;
  const next = [...list];
  const from = next.findIndex((s) => s.id === draggedId);
  const to = next.findIndex((s) => s.id === targetId);
  if (from < 0 || to < 0) return list;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function RentadosHomeServicesPage() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [draggingId, setDraggingId] = useState('');
  const [dropTargetId, setDropTargetId] = useState('');
  const draggingIdRef = useRef('');
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    return platformApi.homeServices
      .list()
      .then((data) => setServices(data.services || []))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    document.title = 'Servicios Rentados · Super admin';
    load();
  }, [load]);

  async function persistOrder(nextServices, previousServices) {
    setReordering(true);
    setError('');
    try {
      const data = await platformApi.homeServices.reorder(nextServices.map((s) => s.id));
      setServices(data.services || nextServices);
    } catch (err) {
      setServices(previousServices);
      setError(err.message);
    } finally {
      setReordering(false);
    }
  }

  function handleDragStart(e, serviceId) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG_MIME, serviceId);
    draggingIdRef.current = serviceId;
    setDraggingId(serviceId);
  }

  function handleDragEnd() {
    draggingIdRef.current = '';
    setDraggingId('');
    setDropTargetId('');
  }

  function handleDragOver(e, serviceId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (serviceId !== draggingIdRef.current) setDropTargetId(serviceId);
  }

  async function handleDrop(e, targetId) {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData(DRAG_MIME);
    draggingIdRef.current = '';
    setDraggingId('');
    setDropTargetId('');

    if (!draggedId || draggedId === targetId) return;

    const previous = services;
    const next = reorderServices(services, draggedId, targetId);
    if (next === previous) return;

    setServices(next);
    await persistOrder(next, previous);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
      };
      if (form.slug.trim()) body.slug = form.slug.trim();
      if (form.sortOrder !== '') body.sortOrder = Number(form.sortOrder);

      const data = await platformApi.homeServices.create(body);
      setForm(emptyForm);
      setShowForm(false);
      navigate(`/super-admin/servicios-rentados/${data.service.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header admin-page__header--row">
        <div>
          <h1>Servicios a domicilio Rentados</h1>
          <p>
            Catálogo que ven los residentes (aseo, plomería, etc.). Entra a cada servicio para agregar
            personas o empresas con fotos, videos y hoja de vida.
          </p>
          <p className="admin-page__header-meta">
            {services.length} servicio(s)
            {reordering ? ' · Guardando orden…' : ' · Arrastra las tarjetas (⠿) para ordenar el portal residente'}
          </p>
        </div>
        <button
          type="button"
          className="admin-btn"
          disabled={reordering}
          onClick={() => {
            setShowForm((v) => !v);
            setError('');
          }}
        >
          {showForm ? 'Cerrar' : '+ Agregar servicio'}
        </button>
      </header>

      {error && <div className="admin-error">{error}</div>}

      {showForm && (
        <div className="admin-card">
          <h2>Nuevo servicio</h2>
          <form className="admin-form" onSubmit={handleCreate}>
            <label>
              Nombre
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Electricidad"
                required
                autoFocus
              />
            </label>
            <label>
              Descripción
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Qué incluye este servicio para los residentes"
              />
            </label>
            <label>
              Slug (opcional)
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="electricidad"
              />
            </label>
            <label>
              Orden (opcional)
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                placeholder="Automático si lo dejas vacío"
              />
            </label>
            <div className="admin-actions">
              <button type="submit" className="admin-btn" disabled={saving}>
                {saving ? 'Creando…' : 'Crear y configurar'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm);
                }}
              >
                Cancelar
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Después podrás subir la imagen de portada y los perfiles en la pantalla del servicio.
            </p>
          </form>
        </div>
      )}

      <div className="admin-card-grid">
        {services.map((service, index) => (
          <article
            key={service.id}
            className={[
              'admin-card',
              'admin-home-service-card',
              'admin-home-service-card--sortable',
              draggingId === service.id ? 'is-dragging' : '',
              dropTargetId === service.id ? 'is-drop-target' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onDragOver={(e) => handleDragOver(e, service.id)}
            onDragLeave={() => {
              if (dropTargetId === service.id) setDropTargetId('');
            }}
            onDrop={(e) => handleDrop(e, service.id)}
          >
            <button
              type="button"
              className="admin-home-service-card__drag-handle"
              draggable
              aria-label={`Arrastrar ${service.name} para reordenar`}
              onDragStart={(e) => handleDragStart(e, service.id)}
              onDragEnd={handleDragEnd}
            >
              ⠿
            </button>
            <Link
              to={`/super-admin/servicios-rentados/${service.id}`}
              className="admin-home-service-card__link"
            >
              <span className="admin-home-service-card__order">#{index + 1}</span>
              <div
                className="admin-home-service-card__image"
                style={{
                  backgroundImage: service.imageUrl ? `url('${service.imageUrl}')` : undefined,
                }}
              />
              <h3 style={{ margin: '0 0 0.35rem' }}>{service.name}</h3>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                {service.description}
              </p>
              {service.isActive === false && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#9b1c1c' }}>Inactivo</p>
              )}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
