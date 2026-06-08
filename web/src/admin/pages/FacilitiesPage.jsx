import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, formatCop } from '../../api/client';
import TimeSelectField from '../components/TimeSelectField';
import { buildOpenHourSlots, formatOpenHoursRange } from '../../utils/openHours';
import '../admin.css';

function statusBadge(status) {
  const map = { open: 'open', maintenance: 'maintenance', closed: 'closed' };
  return map[status] || 'pending';
}

const PRICING_LABELS = {
  free: 'Gratis',
  per_use: 'Por uso',
  monthly: 'Mensual',
  per_hour: 'Por hora',
  per_block: 'Por paquete',
};

const BOOKING_MODE_LABELS = {
  free: 'Reserva gratis',
  hourly: 'Por hora',
  blocks: 'Paquetes de horas',
  flat: 'Tarifa fija',
};

const emptyBlock = { label: '', hours: '', price: '' };

const emptyForm = {
  name: '',
  description: '',
  capacity: '',
  open24Hours: false,
  seasonOpenDate: '',
  seasonCloseDate: '',
  openStart: '06:00',
  openEnd: '22:00',
  price: '',
  pricingType: 'free',
  blockWhenOverdue: true,
  bookable: false,
  requiresApproval: false,
  bookingMode: 'free',
  hourlyRate: '',
  flatPrice: '',
  blocks: [{ ...emptyBlock }],
  slotMinutes: '60',
  minDurationMinutes: '60',
  maxDurationMinutes: '480',
  advanceBookingDays: '30',
};

function toDateInput(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function formatFacilityCost(f) {
  if (f.bookable) {
    const mode = f.bookingPricing?.mode || 'free';
    if (mode === 'hourly' && f.bookingPricing?.hourlyRate > 0) {
      return `${formatCop(f.bookingPricing.hourlyRate)}/hora · Reservable`;
    }
    if (mode === 'blocks' && f.bookingPricing?.blocks?.length) {
      return `${f.bookingPricing.blocks.length} paquete(s) · Reservable`;
    }
    if (mode === 'flat' && (f.bookingPricing?.flatPrice || f.price)) {
      return `${formatCop(f.bookingPricing?.flatPrice || f.price)} · Reservable`;
    }
    return 'Reservable · Gratis';
  }

  if (f.price > 0) {
    return `${formatCop(f.price)} · ${PRICING_LABELS[f.pricingType] || f.pricingType}`;
  }
  return 'Gratis';
}

function buildPayload(form) {
  const blocks = form.blocks
    .filter((b) => b.label && b.hours && b.price !== '')
    .map((b) => ({
      label: b.label,
      durationMinutes: Number(b.hours) * 60,
      price: Number(b.price),
    }));

  return {
    name: form.name,
    description: form.description,
    capacity: form.capacity ? Number(form.capacity) : undefined,
    open24Hours: form.open24Hours,
    seasonOpenDate: form.open24Hours ? undefined : form.seasonOpenDate || undefined,
    seasonCloseDate: form.open24Hours ? undefined : form.seasonCloseDate || undefined,
    openHours: form.open24Hours
      ? { start: '00:00', end: '00:00' }
      : { start: form.openStart, end: form.openEnd },
    price: form.price ? Number(form.price) : 0,
    pricingType: form.bookable ? (form.bookingMode === 'hourly' ? 'per_hour' : form.bookingMode === 'blocks' ? 'per_block' : form.pricingType) : form.pricingType,
    blockWhenOverdue: form.blockWhenOverdue,
    bookable: form.bookable,
    requiresApproval: form.requiresApproval,
    bookingPricing: form.bookable
      ? {
          mode: form.bookingMode,
          hourlyRate: form.bookingMode === 'hourly' ? Number(form.hourlyRate || 0) : 0,
          flatPrice: form.bookingMode === 'flat' ? Number(form.flatPrice || form.price || 0) : 0,
          blocks: form.bookingMode === 'blocks' ? blocks : [],
        }
      : undefined,
    bookingRules: form.bookable
      ? {
          slotMinutes: Number(form.slotMinutes || 60),
          minDurationMinutes: Number(form.minDurationMinutes || 60),
          maxDurationMinutes: Number(form.maxDurationMinutes || 480),
          advanceBookingDays: Number(form.advanceBookingDays || 30),
        }
      : undefined,
  };
}

function facilityToForm(facility) {
  const blocks = facility.bookingPricing?.blocks?.length
    ? facility.bookingPricing.blocks.map((b) => ({
        label: b.label,
        hours: String(Math.round(b.durationMinutes / 60)),
        price: String(b.price),
      }))
    : [{ ...emptyBlock }];

  return {
    name: facility.name,
    description: facility.description || '',
    capacity: facility.capacity != null ? String(facility.capacity) : '',
    open24Hours: facility.open24Hours ?? false,
    seasonOpenDate: toDateInput(facility.seasonOpenDate),
    seasonCloseDate: toDateInput(facility.seasonCloseDate),
    openStart: facility.openHours?.start || '06:00',
    openEnd: facility.openHours?.end || '22:00',
    price: facility.price > 0 ? String(facility.price) : '',
    pricingType: facility.pricingType || 'free',
    blockWhenOverdue: facility.blockWhenOverdue ?? true,
    bookable: facility.bookable ?? false,
    requiresApproval: facility.requiresApproval ?? false,
    bookingMode: facility.bookingPricing?.mode || 'free',
    hourlyRate:
      facility.bookingPricing?.hourlyRate > 0 ? String(facility.bookingPricing.hourlyRate) : '',
    flatPrice:
      facility.bookingPricing?.flatPrice > 0
        ? String(facility.bookingPricing.flatPrice)
        : facility.price > 0
          ? String(facility.price)
          : '',
    blocks,
    slotMinutes: String(facility.bookingRules?.slotMinutes || 60),
    minDurationMinutes: String(facility.bookingRules?.minDurationMinutes || 60),
    maxDurationMinutes: String(facility.bookingRules?.maxDurationMinutes || 480),
    advanceBookingDays: String(facility.bookingRules?.advanceBookingDays || 30),
  };
}

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const hoursPreview = useMemo(() => {
    const openHours = form.open24Hours
      ? { start: '00:00', end: '00:00' }
      : { start: form.openStart, end: form.openEnd };
    return buildOpenHourSlots(openHours);
  }, [form.open24Hours, form.openStart, form.openEnd]);

  async function load() {
    const data = await adminApi.facilities.list();
    setFacilities(data.facilities);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function startEdit(facility) {
    setEditingId(facility._id);
    setForm(facilityToForm(facility));
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function updateBlock(index, field, value) {
    setForm((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block, i) => (i === index ? { ...block, [field]: value } : block)),
    }));
  }

  function addBlockRow() {
    setForm((prev) => ({ ...prev, blocks: [...prev.blocks, { ...emptyBlock }] }));
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      const payload = buildPayload(form);
      if (editingId) {
        await adminApi.facilities.update(editingId, payload);
        setEditingId(null);
      } else {
        await adminApi.facilities.create(payload);
      }
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(id) {
    if (!window.confirm('¿Eliminar este servicio?')) return;
    try {
      await adminApi.facilities.remove(id);
      if (editingId === id) cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function closeForMaintenance(id) {
    const reason = window.prompt('Motivo del cierre temporal:');
    if (!reason) return;
    const end = new Date();
    end.setDate(end.getDate() + 7);
    try {
      await adminApi.facilities.maintenance(id, {
        startAt: new Date().toISOString(),
        endAt: end.toISOString(),
        reason,
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reopen(id) {
    try {
      await adminApi.facilities.reopen(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Servicios del conjunto</h1>
        <p>
          Gimnasio, salón social, piscina, BBQ, sauna y más. Configura cobros por hora, paquetes o tarifa fija, y
          gestiona reservas en{' '}
          <Link to="/admin/servicios/reservas">Calendario de reservas</Link>.
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <h2>{editingId ? 'Editar servicio' : 'Agregar servicio'}</h2>
        <form className="admin-form" onSubmit={handleSave}>
          <label>
            Nombre
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Capacidad
            <input
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </label>
          <label className="admin-checkbox" style={{ gridColumn: '1 / -1' }}>
            <input
              type="checkbox"
              checked={form.open24Hours}
              onChange={(e) => setForm({ ...form, open24Hours: e.target.checked })}
            />
            <span>24h — disponible todo el día, sin temporada ni horario fijo</span>
          </label>
          <label>
            Apertura temporada
            <input
              type="date"
              value={form.seasonOpenDate}
              onChange={(e) => setForm({ ...form, seasonOpenDate: e.target.value })}
              disabled={form.open24Hours}
            />
          </label>
          <label>
            Cierre temporada
            <input
              type="date"
              value={form.seasonCloseDate}
              onChange={(e) => setForm({ ...form, seasonCloseDate: e.target.value })}
              disabled={form.open24Hours}
            />
          </label>
          <TimeSelectField
            label="Hora apertura"
            value={form.openStart}
            onChange={(openStart) => setForm({ ...form, openStart })}
            hint="Ej: 8 AM"
            disabled={form.open24Hours}
          />
          <TimeSelectField
            label="Hora cierre"
            value={form.openEnd}
            onChange={(openEnd) => setForm({ ...form, openEnd })}
            hint="Ej: 10 PM = 10 + PM · 1 AM = 1 + AM (madrugada)"
            disabled={form.open24Hours}
          />
          <p className="admin-hours-preview">
            Calendario de reservas:{' '}
            {formatOpenHoursRange(
              form.open24Hours ? { start: '00:00', end: '00:00' } : { start: form.openStart, end: form.openEnd },
              form.open24Hours
            )}{' '}
            · {hoursPreview.rowCount} franja(s) horaria(s)
          </p>

          {!form.bookable && (
            <>
              <label>
                Costo (COP)
                <input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0 = gratis"
                />
              </label>
              <label>
                Tipo de cobro
                <select
                  value={form.pricingType}
                  onChange={(e) => setForm({ ...form, pricingType: e.target.value })}
                >
                  <option value="free">Gratis</option>
                  <option value="per_use">Por uso</option>
                  <option value="monthly">Mensual</option>
                </select>
              </label>
            </>
          )}

          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.blockWhenOverdue}
              onChange={(e) => setForm({ ...form, blockWhenOverdue: e.target.checked })}
            />
            <span>Suspender si hay mora</span>
          </label>

          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.bookable}
              onChange={(e) => setForm({ ...form, bookable: e.target.checked })}
            />
            <span>Reservable en calendario (salón, BBQ, sauna…)</span>
          </label>

          {form.bookable && (
            <>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={form.requiresApproval}
                  onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })}
                />
                <span>Requiere aprobación del administrador</span>
              </label>
              <label>
                Modelo de cobro de reserva
                <select
                  value={form.bookingMode}
                  onChange={(e) => setForm({ ...form, bookingMode: e.target.value })}
                >
                  <option value="free">Gratis</option>
                  <option value="hourly">Por hora</option>
                  <option value="blocks">Paquetes de horas</option>
                  <option value="flat">Tarifa fija por reserva</option>
                </select>
              </label>
              {form.bookingMode === 'hourly' && (
                <label>
                  Precio por hora (COP)
                  <input
                    type="number"
                    min="0"
                    value={form.hourlyRate}
                    onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                    required
                  />
                </label>
              )}
              {form.bookingMode === 'flat' && (
                <label>
                  Tarifa por reserva (COP)
                  <input
                    type="number"
                    min="0"
                    value={form.flatPrice}
                    onChange={(e) => setForm({ ...form, flatPrice: e.target.value })}
                    required
                  />
                </label>
              )}
              {form.bookingMode === 'blocks' && (
                <div className="admin-booking-blocks">
                  <strong>Paquetes de horas</strong>
                  {form.blocks.map((block, index) => (
                    <div key={index} className="admin-booking-block-row">
                      <label>
                        Nombre
                        <input
                          value={block.label}
                          onChange={(e) => updateBlock(index, 'label', e.target.value)}
                          placeholder="4 horas"
                        />
                      </label>
                      <label>
                        Horas
                        <input
                          type="number"
                          min="1"
                          value={block.hours}
                          onChange={(e) => updateBlock(index, 'hours', e.target.value)}
                        />
                      </label>
                      <label>
                        Precio (COP)
                        <input
                          type="number"
                          min="0"
                          value={block.price}
                          onChange={(e) => updateBlock(index, 'price', e.target.value)}
                        />
                      </label>
                    </div>
                  ))}
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={addBlockRow}>
                    + Agregar paquete
                  </button>
                </div>
              )}
              <label>
                Duración mínima del slot (min)
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={form.slotMinutes}
                  onChange={(e) => setForm({ ...form, slotMinutes: e.target.value })}
                />
              </label>
              <label>
                Reserva mínima (min)
                <input
                  type="number"
                  min="15"
                  value={form.minDurationMinutes}
                  onChange={(e) => setForm({ ...form, minDurationMinutes: e.target.value })}
                />
              </label>
              <label>
                Reserva máxima (min)
                <input
                  type="number"
                  min="15"
                  value={form.maxDurationMinutes}
                  onChange={(e) => setForm({ ...form, maxDurationMinutes: e.target.value })}
                />
              </label>
              <label>
                Días de anticipación
                <input
                  type="number"
                  min="1"
                  value={form.advanceBookingDays}
                  onChange={(e) => setForm({ ...form, advanceBookingDays: e.target.value })}
                />
              </label>
            </>
          )}

          <label style={{ gridColumn: '1 / -1' }}>
            Descripción
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="admin-actions">
            <button type="submit" className="admin-btn">
              {editingId ? 'Guardar cambios' : 'Crear servicio'}
            </button>
            {editingId && (
              <button type="button" className="admin-btn admin-btn--ghost" onClick={cancelEdit}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="admin-card admin-table-wrap">
        <h2>Servicios registrados</h2>
        {facilities.length === 0 ? (
          <p className="admin-empty">No hay servicios registrados aún.</p>
        ) : (
          <table className="admin-table admin-table--selectable">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Costo / reserva</th>
                <th>Horario</th>
                <th>Temporada</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((f) => (
                <tr key={f._id} className={editingId === f._id ? 'is-selected' : undefined}>
                  <td>
                    {f.name}
                    {f.bookable && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {BOOKING_MODE_LABELS[f.bookingPricing?.mode] || 'Reservable'}
                      </div>
                    )}
                  </td>
                  <td>{formatFacilityCost(f)}</td>
                  <td>
                    {f.open24Hours
                      ? '24 horas'
                      : `${f.openHours?.start} – ${f.openHours?.end}`}
                  </td>
                  <td>
                    {f.open24Hours
                      ? 'Todo el año'
                      : f.seasonOpenDate
                        ? `${new Date(f.seasonOpenDate).toLocaleDateString()} – ${new Date(f.seasonCloseDate).toLocaleDateString()}`
                        : '—'}
                  </td>
                  <td>
                    <span className={`admin-badge admin-badge--${statusBadge(f.status)}`}>{f.status}</span>
                  </td>
                  <td className="admin-actions">
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => startEdit(f)}>
                      Editar
                    </button>
                    {f.bookable && (
                      <Link to="/admin/servicios/reservas" className="admin-btn admin-btn--ghost">
                        Calendario
                      </Link>
                    )}
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      onClick={() => handleRemove(f._id)}
                    >
                      Eliminar
                    </button>
                    {f.status === 'maintenance' ? (
                      <button type="button" className="admin-btn admin-btn--ghost" onClick={() => reopen(f._id)}>
                        Reabrir
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        onClick={() => closeForMaintenance(f._id)}
                      >
                        Cierre temporal
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
