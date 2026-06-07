import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { LOGIN_PORTALS } from '../config/loginPortals';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../api/client';
import './LoginPage.css';

const REDIRECTS = {
  resident: '/app',
  admin: '/admin',
  superadmin: '/super-admin',
  provider: '/provider',
  porteria: '/porteria',
};

export default function LoginPage({ portal = 'resident', redirectTo }) {
  const config = LOGIN_PORTALS[portal] ?? LOGIN_PORTALS.resident;
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginApi(email, password, portal);
      loginSuccess({
        token: data.token,
        user: data.user,
      });
      navigate(redirectTo || REDIRECTS[portal] || '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login" key={portal}>
      <aside className="login__hero" aria-hidden="true">
        <div className="login__hero-bg" />
        <div className="login__hero-overlay login-animate-in login-animate-in--hero-overlay" />
        <div className="login__hero-content">
          <p className="login__hero-tagline login-animate-in login-animate-in--hero-text">
            {config.heroTagline}
          </p>
        </div>
      </aside>

      <main className="login__panel login-animate-in login-animate-in--panel">
        <div className="login__card">
          <header className="login__header">
            <div className="login__logo-wrap login-animate-in login-animate-in--1">
              <Logo size="lg" />
            </div>
            <h1 className="login__title login-animate-in login-animate-in--2">{config.title}</h1>
            <p className="login__subtitle login-animate-in login-animate-in--3">{config.subtitle}</p>
          </header>

          {error && <div className="login__error login-animate-in login-animate-in--4">{error}</div>}

          <form className="login__form" onSubmit={handleSubmit}>
            <div className="login__field login-animate-in login-animate-in--4">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="login__field login-animate-in login-animate-in--5">
              <label htmlFor="password">Contraseña</label>
              <div className="login__password-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login__toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>

            <div className="login__actions-row login-animate-in login-animate-in--6">
              <label className="login__remember">
                <input type="checkbox" name="remember" defaultChecked />
                <span>Mantener sesión iniciada</span>
              </label>
              <a href="#" className="login__link">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <button type="submit" className="login__submit login-animate-in login-animate-in--7" disabled={loading}>
              {loading ? 'Ingresando…' : config.submitLabel}
            </button>
          </form>

          <nav className="login__portal-nav login-animate-in login-animate-in--8" aria-label="Otros portales">
            <p className="login__portal-nav-label">{config.switchPrompt}</p>
            <div className="login__portal-nav-links">
              {config.switchLinks.map((link, index) => (
                <span key={link.to}>
                  {index > 0 && <span className="login__portal-nav-sep">·</span>}
                  <Link to={link.to} className="login__portal-nav-link">
                    {link.label}
                  </Link>
                </span>
              ))}
            </div>
          </nav>

          <footer className="login__footer login-animate-in login-animate-in--9">
            <p>
              ¿Necesitas ayuda?{' '}
              <a href="mailto:soporte@rentados.co" className="login__link">
                Contáctanos
              </a>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
