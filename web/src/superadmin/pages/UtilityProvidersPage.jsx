import { useEffect, useState } from 'react';
import { platformApi } from '../../api/client';
import '../../admin/admin.css';

const emptyForm = {
  name: '',
  slug: '',
  serviceType: 'energy',
  cities: 'Barranquilla',
  accountCodeLabel: 'Código de usuario',
  accountCodeHelp: '',
  websiteUrl: '',
  paymentUrl: '',
  integrationStatus: 'manual',
  integrationNotes: '',
  sortOrder: '0',
};

const billFormEmpty = {
  providerId: '',
  accountCode: '',
  amount: '',
  period: '',
  dueDate: '',
  paymentUrl: '',
};

export default function UtilityProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [billForm, setBillForm] = useState(billFormEmpty);
  const [editingId, setEditingId] = useState(null);
  const [cityFilter, setCityFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await platformApi.utilityProviders({
      ...(cityFilter.trim() ? { city: cityFilter.trim() } : {}),
    });
    setProviders(data.providers || []);
    setServiceTypes(data.serviceTypes || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function startEdit(provider) {
    setEditingId(provider.id);
    setForm({
      name: provider.name,
      slug: provider.slug,
      serviceType: provider.serviceType,
      cities: (provider.cities || []).join(', '),
      accountCodeLabel: provider.accountCodeLabel || 'Código de usuario',
      accountCodeHelp: provider.accountCodeHelp || '',
      websiteUrl: provider.websiteUrl || '',
      paymentUrl: provider.paymentUrl || '',
      integrationStatus: provider.integrationStatus || 'manual',
      integrationNotes: provider.integrationNotes || '',
      sortOrder: String(provider.sortOrder ?? 0),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const body = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      serviceType: form.serviceType,
      cities: form.cities
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      accountCodeLabel: form.accountCodeLabel.trim() || 'Código de usuario',
      accountCodeHelp: form.accountCodeHelp.trim() || undefined,
      websiteUrl: form.websiteUrl.trim() || undefined,
      paymentUrl: form.paymentUrl.trim() || undefined,
      integrationStatus: form.integrationStatus,
      integrationNotes: form.integrationNotes.trim() || undefined,
      sortOrder: Number(form.sortOrder) || 0,
    };

    try {
      setSaving(true);
      if (editingId) {
        await platformApi.updateUtilityProvider(editingId, body);
        setSuccess(`Proveedor "${body.name}" actualizado.`);
      } else {
        await platformApi.createUtilityProvider(body);
        setSuccess(`Proveedor "${body.name}" creado.`);
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id) {
    if (!window.confirm('¿Desactivar este proveedor?')) return;
    try {
      await platformApi.removeUtilityProvider(id);
      setSuccess('Proveedor desactivado.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function publishBill(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      setSaving(true);
      await platformApi.createUtilityBill({
        providerId: billForm.providerId,
        accountCode: billForm.accountCode.trim(),
        amount: Number(billForm.amount),
        period: billForm.period.trim() || undefined,
        dueDate: billForm.dueDate || undefined,
        paymentUrl: billForm.paymentUrl.trim() || undefined,
        notify: true,
      });
      setSuccess('Factura publicada y notificación enviada al residente.');
      setBillForm(billFormEmpty);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const active = providers.filter((p) => p.isActive !== false);

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Servicios públicos</h1>
        <p>
          Catálogo de empresas de energía, agua, gas, internet y telefonía por ciudad. Al registrar
          un conjunto con ciudad (ej. Barranquilla), los residentes solo ven los proveedores de esa
          ciudad.
        </p>
        <p className="admin-page__header-meta">{active.length} proveedor(es) activo(s)</p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && (
        <div className="admin-card" style={{ background: '#dceee4', color: '#1e5a3d' }}>
          {success}
        </div>
      )}

      <div className="admin-card" style={{ marginBottom: '1rem' }}>
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            load().catch((err) => setError(err.message));
          }}
          style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}
        >
          <label style={{ flex: '1 1 200px' }}>
            Filtrar por ciudad
            <input
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              placeholder="Barranquilla"
            />
          </label>
          <button type="submit">Filtrar</button>
          <button
            type="button"
            className="admin-btn-secondary"
            onClick={() => {
              setCityFilter('');
              platformApi
                .utilityProviders()
                .then((data) => {
                  setProviders(data.providers || []);
                  setServiceTypes(data.serviceTypes || []);
                })
                .catch((err) => setError(err.message));
            }}
          >
            Ver todos
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2>{editingId ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            Nombre
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Slug
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="aire-energia"
            />
          </label>
          <label>
            Tipo
            <select
              value={form.serviceType}
              onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
            >
              {(serviceTypes.length
                ? serviceTypes
                : [
                    { key: 'energy', label: 'Energía' },
                    { key: 'water', label: 'Agua' },
                    { key: 'gas', label: 'Gas' },
                    { key: 'internet', label: 'Internet' },
                    { key: 'phone', label: 'Telefonía' },
                  ]
              ).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ciudades (separadas por coma)
            <input
              value={form.cities}
              onChange={(e) => setForm({ ...form, cities: e.target.value })}
              placeholder="Barranquilla, Cartagena"
              required
            />
          </label>
          <label>
            Etiqueta del código
            <input
              value={form.accountCodeLabel}
              onChange={(e) => setForm({ ...form, accountCodeLabel: e.target.value })}
              placeholder="NIC"
            />
          </label>
          <label>
            Ayuda para el residente
            <input
              value={form.accountCodeHelp}
              onChange={(e) => setForm({ ...form, accountCodeHelp: e.target.value })}
            />
          </label>
          <label>
            URL web
            <input
              value={form.websiteUrl}
              onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
            />
          </label>
          <label>
            URL de pago
            <input
              value={form.paymentUrl}
              onChange={(e) => setForm({ ...form, paymentUrl: e.target.value })}
            />
          </label>
          <label>
            Integración
            <select
              value={form.integrationStatus}
              onChange={(e) => setForm({ ...form, integrationStatus: e.target.value })}
            >
              <option value="manual">Manual</option>
              <option value="api">API</option>
              <option value="webhook">Webhook</option>
            </select>
          </label>
          <label>
            Notas de integración
            <input
              value={form.integrationNotes}
              onChange={(e) => setForm({ ...form, integrationNotes: e.target.value })}
            />
          </label>
          <label>
            Orden
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : editingId ? 'Actualizar' : 'Crear'}
            </button>
            {editingId && (
              <button type="button" className="admin-btn-secondary" onClick={cancelEdit}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="admin-card">
        <h2>Publicar factura (prueba / operación)</h2>
        <p style={{ color: '#5c564e', marginTop: 0 }}>
          El residente debe haber vinculado antes su código (ej. Aire NIC 7945070). Se notifica en la
          app y aparece en Servicios públicos.
        </p>
        <form className="admin-form" onSubmit={publishBill}>
          <label>
            Proveedor
            <select
              value={billForm.providerId}
              onChange={(e) => setBillForm({ ...billForm, providerId: e.target.value })}
              required
            >
              <option value="">Selecciona…</option>
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.serviceTypeLabel} · {(p.cities || []).join(', ')}
                </option>
              ))}
            </select>
          </label>
          <label>
            Código del residente
            <input
              value={billForm.accountCode}
              onChange={(e) => setBillForm({ ...billForm, accountCode: e.target.value })}
              placeholder="7945070"
              required
            />
          </label>
          <label>
            Valor
            <input
              type="number"
              min="0"
              step="1"
              value={billForm.amount}
              onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })}
              required
            />
          </label>
          <label>
            Periodo
            <input
              value={billForm.period}
              onChange={(e) => setBillForm({ ...billForm, period: e.target.value })}
              placeholder="Julio 2026"
            />
          </label>
          <label>
            Vence
            <input
              type="date"
              value={billForm.dueDate}
              onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
            />
          </label>
          <label>
            URL de pago (opcional)
            <input
              value={billForm.paymentUrl}
              onChange={(e) => setBillForm({ ...billForm, paymentUrl: e.target.value })}
            />
          </label>
          <button type="submit" disabled={saving}>
            Publicar factura
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2>Proveedores</h2>
        {providers.length === 0 ? (
          <p>No hay proveedores. Ejecuta <code>npm run seed:utility-providers</code> o crea uno.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Ciudades</th>
                  <th>Código</th>
                  <th>Integración</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.id} style={{ opacity: provider.isActive === false ? 0.5 : 1 }}>
                    <td>{provider.name}</td>
                    <td>{provider.serviceTypeLabel}</td>
                    <td>{(provider.cities || []).join(', ')}</td>
                    <td>{provider.accountCodeLabel}</td>
                    <td>{provider.integrationStatus}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => startEdit(provider)}>
                        Editar
                      </button>{' '}
                      {provider.isActive !== false && (
                        <button type="button" onClick={() => deactivate(provider.id)}>
                          Desactivar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
