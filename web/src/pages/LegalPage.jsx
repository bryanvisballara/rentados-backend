import { Link } from 'react-router-dom';
import './LegalPage.css';

const PAGES = {
  privacidad: {
    title: 'Política de privacidad',
    updated: '28 de septiembre de 2026',
  },
  soporte: {
    title: 'Soporte',
    updated: '28 de septiembre de 2026',
  },
  marketing: {
    title: 'Rentados',
    updated: '28 de septiembre de 2026',
  },
};

export default function LegalPage({ page = 'privacidad' }) {
  const current = PAGES[page] || PAGES.privacidad;

  return (
    <main className="legal">
      <header className="legal__header">
        <p className="legal__brand">Rentados</p>
        <h1>{current.title}</h1>
        <p>Actualizado el {current.updated}</p>
      </header>

      {page === 'privacidad' && (
        <article className="legal__body">
          <p>
            Rentados es la app para residentes de un conjunto. La opera WW TECNO S.A.S. Esta política
            explica qué datos usamos y cómo puedes eliminarlos.
          </p>
          <h2>Datos que guardamos</h2>
          <ul>
            <li>Nombre, correo, teléfono y contraseña de tu cuenta.</li>
            <li>Conjunto, torre y apartamento, para identificarte dentro de la copropiedad.</li>
            <li>Pedidos de restaurante o shop, visitas que registras y mensajes de la app.</li>
            <li>
              Si guardas una tarjeta, solo la marca, los últimos 4 dígitos y un token. No guardamos el
              número completo ni el código de seguridad.
            </li>
          </ul>
          <h2>Para qué los usamos</h2>
          <p>
            Para dejarte entrar, mostrar la administración de tu unidad, recibir pedidos, avisos del
            conjunto y el soporte que nos pidas. No vendemos tus datos.
          </p>
          <h2>Eliminar la cuenta</h2>
          <p>
            En la app, abre SOS y al final pulsa Eliminar cuenta. Borramos tu usuario, tu sesión, tus tarjetas
            guardadas y los datos personales de tus pedidos. Las cuotas de administración del
            apartamento siguen en la contabilidad del conjunto, sin tu nombre de usuario.
          </p>
          <h2>Contacto</h2>
          <p>
            Escríbenos a <a href="mailto:soporte@rentados.co">soporte@rentados.co</a>.
          </p>
        </article>
      )}

      {page === 'soporte' && (
        <article className="legal__body">
          <p>Si necesitas ayuda con Rentados, escribe a soporte@rentados.co.</p>
          <h2>Qué podemos ayudarte</h2>
          <ul>
            <li>No puedes entrar con tu código o correo.</li>
            <li>Un pago, un pedido o un aviso del conjunto no se ve bien.</li>
            <li>Quieres eliminar tu cuenta.</li>
          </ul>
          <h2>Eliminar la cuenta</h2>
          <p>
            Ábrela tú mismo: inicia sesión, abre SOS y al final pulsa Eliminar cuenta. No hace falta
            escribirnos para eso. La opción está dentro de la app.
          </p>
          <p>
            También puedes leer la <Link to="/privacidad">política de privacidad</Link>.
          </p>
        </article>
      )}

      {page === 'marketing' && (
        <article className="legal__body">
          <p>
            Rentados es la app del conjunto residencial. El residente consulta su administración, paga
            cuotas, registra visitas, habla con portería y pide en los restaurantes y la tienda del
            conjunto.
          </p>
          <p>
            Cada copropiedad tiene su propio ingreso. La empresa que administra varios edificios entra
            a los suyos; el administrador de un solo edificio ve únicamente ese.
          </p>
          <p>
            Soporte: <a href="mailto:soporte@rentados.co">soporte@rentados.co</a>.{' '}
            <Link to="/privacidad">Política de privacidad</Link>.
          </p>
        </article>
      )}

      <nav className="legal__nav" aria-label="Información de Rentados">
        <Link to="/privacidad">Privacidad</Link>
        <Link to="/soporte">Soporte</Link>
        <Link to="/marketing">Rentados</Link>
        <Link to="/login">Iniciar sesión</Link>
      </nav>
    </main>
  );
}
