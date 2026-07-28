import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import { fetchServiceCategories, registerProvider } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import '../../pages/LoginPage.css';
import './ProviderRegisterPage.css';

function categoryKey(id) {
  return String(id);
}

export default function ProviderRegisterPage() {
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    businessName: '',
    description: '',
    categoryIds: [],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Rentados — Registro prestador';
    return () => {
      document.title = 'Rentados — Iniciar sesión';
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setLoadingCategories(true);
      setCategoriesError('');
      try {
        const data = await fetchServiceCategories();
        if (cancelled) return;
        setCategories((data.categories || []).filter((category) => category.isActive !== false));
      } catch (err) {
        if (cancelled) return;
        setCategories([]);
        setCategoriesError(err.message || 'No se pudieron cargar las categorías.');
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    }

    loadCategories();

    function handleRefresh() {
      fetchServiceCategories()
        .then((data) => {
          setCategories((data.categories || []).filter((category) => category.isActive !== false));
          setCategoriesError('');
        })
        .catch(() => {});
    }

    window.addEventListener('focus', handleRefresh);
    document.addEventListener('visibilitychange', handleRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleRefresh);
      document.removeEventListener('visibilitychange', handleRefresh);
    };
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleCategory(id) {
    const key = categoryKey(id);
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.map(categoryKey).includes(key)
        ? prev.categoryIds.filter((item) => categoryKey(item) !== key)
        : [...prev.categoryIds, key],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (categories.length > 0 && form.categoryIds.length === 0) {
      setError('Selecciona al menos una categoría de servicio.');
      return;
    }

    setLoading(true);
    try {
      const data = await registerProvider(form);
      loginSuccess({ token: data.token, user: data.user });
      navigate('/provider');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login provider-register">
      <aside className="login__hero" aria-hidden="true">
        <div
          className="login__hero-bg"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1400&q=80')",
          }}
        />
        <div className="login__hero-overlay login-animate-in login-animate-in--hero-overlay" />
        <div className="login__hero-content">
          <p className="login__hero-tagline login-animate-in login-animate-in--hero-text">
            Ofrece tus servicios en conjuntos residenciales
          </p>
        </div>
      </aside>

      <main className="login__panel login-animate-in login-animate-in--panel">
        <div className="login__card provider-register__card">
          <header className="login__header">
            <div className="login__logo-wrap login-animate-in login-animate-in--1">
              <Logo size="lg" />
            </div>
            <h1 className="login__title login-animate-in login-animate-in--2">
              Registro de prestador
            </h1>
            <p className="login__subtitle login-animate-in login-animate-in--3">
              Solicita unirte a la red Rentados. Revisaremos tu perfil y te contactaremos para la
              entrevista.
            </p>
          </header>

          {error && <div className="login__error login-animate-in login-animate-in--4">{error}</div>}

          <form className="login__form provider-register__form" onSubmit={handleSubmit}>
            <div className="provider-register__section">
              <p className="provider-register__section-title">Datos personales</p>
              <div className="provider-register__row">
                <div className="login__field">
                  <label htmlFor="firstName">Nombre</label>
                  <input
                    id="firstName"
                    name="firstName"
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    required
                  />
                </div>
                <div className="login__field">
                  <label htmlFor="lastName">Apellido</label>
                  <input
                    id="lastName"
                    name="lastName"
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="login__field">
                <label htmlFor="email">Correo</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  required
                />
              </div>

              <div className="provider-register__row">
                <div className="login__field">
                  <label htmlFor="phone">Teléfono</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+57 300 000 0000"
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                  />
                </div>
                <div className="login__field">
                  <label htmlFor="password">Contraseña</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="provider-register__section">
              <p className="provider-register__section-title">Tu negocio</p>
              <div className="login__field">
                <label htmlFor="businessName">Nombre del negocio</label>
                <input
                  id="businessName"
                  name="businessName"
                  autoComplete="organization"
                  value={form.businessName}
                  onChange={(e) => updateField('businessName', e.target.value)}
                  required
                />
              </div>
              <div className="login__field">
                <label htmlFor="description">Descripción</label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Cuéntanos qué servicios ofreces y tu experiencia."
                />
              </div>
            </div>

            <fieldset className="provider-register__categories">
              <legend>Categorías de servicio</legend>
              <p className="provider-register__categories-hint">
                Catálogo publicado desde super administración · solo categorías activas
                {!loadingCategories && categories.length > 0 ? ` · ${categories.length} disponibles` : ''}.
              </p>
              <div className="provider-register__category-grid">
                {loadingCategories ? (
                  <span className="login__subtitle">Cargando categorías…</span>
                ) : categoriesError ? (
                  <span className="provider-register__categories-empty">{categoriesError}</span>
                ) : categories.length === 0 ? (
                  <span className="provider-register__categories-empty">
                    No hay categorías activas en el catálogo. Configúralas en super administración.
                  </span>
                ) : (
                  categories.map((category) => {
                    const id = category.id || category._id;
                    return (
                      <label key={id} className="provider-register__category">
                        <input
                          type="checkbox"
                          checked={form.categoryIds.map(categoryKey).includes(categoryKey(id))}
                          onChange={() => toggleCategory(id)}
                        />
                        <span>
                          <span className="provider-register__category-name">{category.name}</span>
                          {category.description && (
                            <span className="provider-register__category-desc">
                              {category.description}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </fieldset>

            <button type="submit" className="login__submit" disabled={loading}>
              {loading ? 'Enviando solicitud…' : 'Enviar solicitud'}
            </button>
          </form>

          <p className="provider-register__footer">
            ¿Ya tienes cuenta? <Link to="/provider/login">Iniciar sesión</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
