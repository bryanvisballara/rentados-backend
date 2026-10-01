import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformApi } from '../../api/client';
import WeeklyHoursEditor from '../../components/WeeklyHoursEditor';
import {
  defaultRestaurantWeeklyHours,
  hasEnabledRestaurantDay,
  normalizeRestaurantWeeklyHours,
} from '../../utils/restaurantHours';
import '../../admin/admin.css';
import './ShopPage.css';

const emptyRestaurant = {
  name: '',
  shortDescription: '',
  cuisineType: '',
  city: '',
};

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [form, setForm] = useState(emptyRestaurant);
  const [weeklyHours, setWeeklyHours] = useState(defaultRestaurantWeeklyHours());
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
    setWeeklyHours(defaultRestaurantWeeklyHours());
    setCoverImage(null);
  }

  function startEdit(restaurant) {
    setEditingId(restaurant._id);
    setShowForm(true);
    setForm({
      name: restaurant.name,
      shortDescription: restaurant.shortDescription || '',
      cuisineType: restaurant.cuisineType || '',
      city: restaurant.city || '',
    });
    setWeeklyHours(
      normalizeRestaurantWeeklyHours(restaurant.weeklyHours?.length ? restaurant.weeklyHours : null)
    );
    setCoverImage(restaurant.coverImage || null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!hasEnabledRestaurantDay(weeklyHours)) {
      setError('Selecciona al menos un día con horario.');
      return;
    }

    if (!editingId && !coverImage?.url) {
      setError('Sube la foto del restaurante.');
      return;
    }

    const body = {
      name: form.name.trim(),
      shortDescription: form.shortDescription.trim() || undefined,
      cuisineType: form.cuisineType.trim() || undefined,
      city: form.city.trim() || undefined,
      country: 'Colombia',
      currency: 'COP',
      weeklyHours: normalizeRestaurantWeeklyHours(weeklyHours),
      targetCountries: ['Colombia'],
      targetCities: form.city.trim() ? [form.city.trim()] : [],
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
      setSuccess('Foto subida.');
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
            <p>Nombre, foto, descripción, cocina, ciudad y horario por día.</p>
          </div>
          <form className="shop-form shop-form--category" onSubmit={handleSubmit}>
            <div className="shop-form__grid shop-form__grid--restaurant-simple">
              <div className="shop-form__primary">
                <label className="shop-field">
                  <span className="shop-field__label">Nombre del restaurante</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </label>

                <label className="shop-field">
                  <span className="shop-field__label">Descripción corta</span>
                  <input
                    value={form.shortDescription}
                    onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                    placeholder="Ej: Shawarma típico con un estilo local"
                  />
                </label>

                <div className="shop-field-row">
                  <label className="shop-field">
                    <span className="shop-field__label">Tipo de cocina</span>
                    <input
                      value={form.cuisineType}
                      onChange={(e) => setForm({ ...form, cuisineType: e.target.value })}
                      placeholder="Ej: Árabe, Colombiana"
                    />
                  </label>
                  <label className="shop-field">
                    <span className="shop-field__label">Ciudad</span>
                    <input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Ej: Barranquilla"
                    />
                  </label>
                </div>

                <div className="shop-field">
                  <span className="shop-field__label">Horario</span>
                  <WeeklyHoursEditor value={weeklyHours} onChange={setWeeklyHours} />
                </div>
              </div>

              <div className="shop-form__sidebar">
                <div className="shop-panel">
                  <p className="shop-panel__title">Foto</p>
                  {coverImage?.url && (
                    <img
                      src={coverImage.url}
                      alt=""
                      className="shop-product-cell__thumb"
                      style={{ width: '100%', height: 'auto', aspectRatio: '16/9' }}
                    />
                  )}
                  <label className="shop-upload">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      disabled={uploading}
                    />
                    <span className="shop-upload__title">
                      {uploading ? 'Subiendo…' : 'Subir foto del restaurante'}
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
              <th>Horario</th>
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
                  <td>{restaurant.city || '—'}</td>
                  <td>{restaurant.cuisineType || '—'}</td>
                  <td>{restaurant.openingHours || '—'}</td>
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
