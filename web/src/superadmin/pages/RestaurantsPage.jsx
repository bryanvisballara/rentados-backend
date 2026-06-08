import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney, platformApi } from '../../api/client';
import '../../admin/admin.css';
import './ShopPage.css';

const COUNTRIES = [
  { value: 'Colombia', label: 'Colombia', currency: 'COP' },
  { value: 'México', label: 'México', currency: 'MXN' },
];

const emptyRestaurant = {
  name: '',
  slug: '',
  shortDescription: '',
  description: '',
  cuisineType: '',
  city: '',
  country: 'Colombia',
  address: '',
  phone: '',
  email: '',
  openingHours: '',
  deliveryFee: '0',
  minOrderAmount: '0',
  avgPrepMinutes: '30',
  isFeatured: false,
  sortOrder: '0',
  coverImageUrl: '',
};

function getCurrency(country) {
  return COUNTRIES.find((item) => item.value === country)?.currency || 'COP';
}

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [form, setForm] = useState(emptyRestaurant);
  const [coverImage, setCoverImage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    const data = await platformApi.restaurants();
    setRestaurants(data.restaurants);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(emptyRestaurant);
    setCoverImage(null);
  }

  function startEdit(restaurant) {
    setEditingId(restaurant._id);
    setShowForm(true);
    setForm({
      name: restaurant.name,
      slug: restaurant.slug,
      shortDescription: restaurant.shortDescription || '',
      description: restaurant.description || '',
      cuisineType: restaurant.cuisineType || '',
      city: restaurant.city || '',
      country: restaurant.country || 'Colombia',
      address: restaurant.address || '',
      phone: restaurant.phone || '',
      email: restaurant.email || '',
      openingHours: restaurant.openingHours || '',
      deliveryFee: String(restaurant.deliveryFee ?? 0),
      minOrderAmount: String(restaurant.minOrderAmount ?? 0),
      avgPrepMinutes: restaurant.avgPrepMinutes != null ? String(restaurant.avgPrepMinutes) : '',
      isFeatured: Boolean(restaurant.isFeatured),
      sortOrder: String(restaurant.sortOrder ?? 0),
      coverImageUrl: '',
    });
    setCoverImage(restaurant.coverImage || null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const body = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      shortDescription: form.shortDescription.trim() || undefined,
      description: form.description.trim() || undefined,
      cuisineType: form.cuisineType.trim() || undefined,
      city: form.city.trim() || undefined,
      country: form.country,
      address: form.address.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      openingHours: form.openingHours.trim() || undefined,
      deliveryFee: Number(form.deliveryFee) || 0,
      minOrderAmount: Number(form.minOrderAmount) || 0,
      currency: getCurrency(form.country),
      avgPrepMinutes: form.avgPrepMinutes !== '' ? Number(form.avgPrepMinutes) : undefined,
      targetCountries: [form.country],
      targetCities: form.city.trim() ? [form.city.trim()] : [],
      isFeatured: form.isFeatured,
      sortOrder: Number(form.sortOrder) || 0,
      coverImage: coverImage || undefined,
    };

    try {
      if (editingId) {
        await platformApi.updateRestaurant(editingId, body);
        setSuccess('Restaurante actualizado.');
      } else {
        await platformApi.createRestaurant(body);
        setSuccess('Restaurante creado.');
      }
      resetForm();
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deactivate(id) {
    if (!window.confirm('¿Desactivar este restaurante?')) return;
    try {
      await platformApi.removeRestaurant(id);
      setSuccess('Restaurante desactivado.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const data = await platformApi.uploadRestaurantImage(file, 'cover');
      setCoverImage(data.image);
      setSuccess('Imagen de portada subida.');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const activeRestaurants = restaurants.filter((item) => item.isActive !== false);

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Restaurantes Rentados</h1>
        <p>
          Restaurantes propios de la plataforma. Administra sedes, menús y pedidos desde aquí.
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-success">{success}</div>}

      <div className="shop-page__toolbar">
        <button
          type="button"
          className="admin-btn"
          onClick={() => {
            resetForm();
            setShowForm((prev) => !prev);
          }}
        >
          {showForm ? 'Ocultar formulario' : '+ Nuevo restaurante'}
        </button>
        <Link to="/super-admin/restaurantes-pedidos" className="admin-btn admin-btn--ghost">
          Ver pedidos
        </Link>
      </div>

      {showForm && (
        <div className="shop-editor">
          <div className="shop-editor__head">
            <h2>{editingId ? 'Editar restaurante' : 'Nuevo restaurante'}</h2>
            <p>Restaurante operado directamente por Rentados, visible para residentes.</p>
          </div>
          <form className="shop-form shop-form--category" onSubmit={handleSubmit}>
            <div className="shop-form__country-bar">
              <label className="shop-field shop-field--country">
                <span className="shop-field__label">País</span>
                <select
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                >
                  {COUNTRIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="shop-form__grid">
              <div className="shop-form__primary">
                <div className="shop-field-row">
                  <label className="shop-field">
                    <span className="shop-field__label">Nombre</span>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </label>
                  <label className="shop-field">
                    <span className="shop-field__label">Slug</span>
                    <input
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      placeholder="Opcional"
                    />
                  </label>
                </div>
                <label className="shop-field">
                  <span className="shop-field__label">Descripción corta</span>
                  <input
                    value={form.shortDescription}
                    onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                  />
                </label>
                <label className="shop-field">
                  <span className="shop-field__label">Descripción</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                  />
                </label>
                <div className="shop-field-row">
                  <label className="shop-field">
                    <span className="shop-field__label">Tipo de cocina</span>
                    <input
                      value={form.cuisineType}
                      onChange={(e) => setForm({ ...form, cuisineType: e.target.value })}
                      placeholder="Ej: Colombiana, Saludable"
                    />
                  </label>
                  <label className="shop-field">
                    <span className="shop-field__label">Ciudad</span>
                    <input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </label>
                </div>
                <label className="shop-field">
                  <span className="shop-field__label">Dirección</span>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </label>
                <div className="shop-field-row">
                  <label className="shop-field">
                    <span className="shop-field__label">Teléfono</span>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </label>
                  <label className="shop-field">
                    <span className="shop-field__label">Correo</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </label>
                </div>
                <label className="shop-field">
                  <span className="shop-field__label">Horario</span>
                  <input
                    value={form.openingHours}
                    onChange={(e) => setForm({ ...form, openingHours: e.target.value })}
                    placeholder="Lun–Dom 11:00 – 22:00"
                  />
                </label>
              </div>

              <div className="shop-form__sidebar">
                <div className="shop-panel">
                  <p className="shop-panel__title">Operación</p>
                  <div className="shop-field-row shop-field-row--compact">
                    <label className="shop-field">
                      <span className="shop-field__label">Domicilio</span>
                      <input
                        type="number"
                        min="0"
                        value={form.deliveryFee}
                        onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })}
                      />
                    </label>
                    <label className="shop-field">
                      <span className="shop-field__label">Pedido mínimo</span>
                      <input
                        type="number"
                        min="0"
                        value={form.minOrderAmount}
                        onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                      />
                    </label>
                  </div>
                  <label className="shop-field">
                    <span className="shop-field__label">Tiempo prep. (min)</span>
                    <input
                      type="number"
                      min="0"
                      value={form.avgPrepMinutes}
                      onChange={(e) => setForm({ ...form, avgPrepMinutes: e.target.value })}
                    />
                  </label>
                  <label className="shop-field">
                    <span className="shop-field__label">Orden</span>
                    <input
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    />
                  </label>
                  <label className="shop-check">
                    <input
                      type="checkbox"
                      checked={form.isFeatured}
                      onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                    />
                    <span>Destacado</span>
                  </label>
                </div>

                <div className="shop-panel">
                  <p className="shop-panel__title">Portada</p>
                  {coverImage?.url && (
                    <img
                      src={coverImage.url}
                      alt=""
                      className="shop-product-cell__thumb"
                      style={{ width: '100%', height: 'auto', aspectRatio: '16/9' }}
                    />
                  )}
                  <label className="shop-upload">
                    <input type="file" accept="image/*" onChange={handleCoverUpload} disabled={uploading} />
                    <span className="shop-upload__title">
                      {uploading ? 'Subiendo…' : 'Subir imagen de portada'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="shop-form__bar">
              <button type="submit" className="admin-btn">
                {editingId ? 'Guardar restaurante' : 'Crear restaurante'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-card admin-table-wrap shop-table-card">
        <div className="shop-table-card__head">
          <h2>Restaurantes activos</h2>
          <p>{activeRestaurants.length} restaurante(s) propios de Rentados.</p>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Restaurante</th>
              <th>Ciudad</th>
              <th>Cocina</th>
              <th>Domicilio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {activeRestaurants.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-empty">
                  No hay restaurantes registrados.
                </td>
              </tr>
            ) : (
              activeRestaurants.map((restaurant) => (
                <tr key={restaurant._id}>
                  <td>
                    <div className="shop-product-cell">
                      {restaurant.coverImage?.url && (
                        <img
                          src={restaurant.coverImage.url}
                          alt=""
                          className="shop-product-cell__thumb"
                        />
                      )}
                      <div>
                        <span className="shop-product-cell__name">{restaurant.name}</span>
                        <span className="shop-product-cell__meta">
                          {restaurant.shortDescription || restaurant.slug}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {restaurant.city || '—'}
                    {restaurant.country ? ` · ${restaurant.country}` : ''}
                  </td>
                  <td>{restaurant.cuisineType || '—'}</td>
                  <td>
                    {formatMoney(restaurant.deliveryFee || 0, restaurant.currency || 'COP')}
                  </td>
                  <td className="admin-actions">
                    <Link
                      to={`/super-admin/restaurantes/${restaurant._id}/menu`}
                      className="admin-btn"
                    >
                      Menú
                    </Link>
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost"
                      onClick={() => startEdit(restaurant)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      onClick={() => deactivate(restaurant._id)}
                    >
                      Desactivar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
