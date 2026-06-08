import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import { fetchServiceCategories, registerProvider } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import '../ProviderLayout.css';
import '../../pages/LoginPage.css';

export default function ProviderRegisterPage() {
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
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
    fetchServiceCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => {});
  }, []);

  function toggleCategory(id) {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((item) => item !== id)
        : [...prev.categoryIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
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
    <div className="login" style={{ minHeight: '100vh' }}>
      <div className="login__panel" style={{ maxWidth: 520, margin: '2rem auto' }}>
        <Logo size="sm" />
        <h1>Registro de prestador</h1>
        <p>Solicita prestar servicios en la red Rentados.</p>

        {error && <div className="admin-error">{error}</div>}

        <form onSubmit={handleSubmit} className="admin-form" style={{ marginTop: '1rem' }}>
          <label>
            Nombre
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
          </label>
          <label>
            Apellido
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
          </label>
          <label>
            Correo
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
          <label>
            Nombre del negocio
            <input
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              required
            />
          </label>
          <label>
            Descripción
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </label>
          <fieldset>
            <legend>Categorías de servicio</legend>
            {categories.map((c) => (
              <label key={c._id} className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={form.categoryIds.includes(c._id)}
                  onChange={() => toggleCategory(c._id)}
                />
                {c.name}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="admin-btn" disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </form>

        <p style={{ marginTop: '1rem' }}>
          ¿Ya tienes cuenta? <Link to="/provider/login">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
