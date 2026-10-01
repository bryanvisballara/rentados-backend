import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import '../admin.css';

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const PROGRAMS = [
  {
    id: 'siigo',
    name: 'Siigo Nube',
    mode: 'api',
    summary: 'El más usado por contadores en Colombia. Se conecta con usuario y clave API.',
  },
  {
    id: 'alegra',
    name: 'Alegra',
    mode: 'api',
    summary: 'Se conecta con el correo y el token de integraciones.',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    mode: 'oauth',
    summary: 'Si el contador usa Intuit. Mientras tanto se descarga la cartera.',
  },
  {
    id: 'worldoffice',
    name: 'World Office',
    mode: 'file',
    summary: 'No tiene clave para enlazar. Se descarga el archivo del mes.',
  },
  {
    id: 'helisa',
    name: 'Helisa',
    mode: 'file',
    summary: 'No tiene clave para enlazar. Se descarga el archivo del mes.',
  },
  {
    id: 'loggro',
    name: 'Loggro',
    mode: 'file',
    summary: 'Se descarga el archivo del mes para el contador.',
  },
];

const HINTS = {
  siigo: 'En Siigo Nube abre Alianzas → Mi credencial API y copia el usuario y la clave de acceso.',
  alegra: 'En Alegra abre Soluciones → Integraciones → Integración manual y copia el usuario y el token.',
  quickbooks: 'QuickBooks pide iniciar sesión con Intuit. Mientras Rentados termina ese botón, descarga la cartera y entrégasela al contador.',
  worldoffice: 'World Office no deja pegar una clave. Descarga el archivo del mes y el contador lo importa.',
  helisa: 'Helisa no deja pegar una clave. Descarga el archivo del mes y el contador lo importa.',
  loggro: 'Loggro no publica una clave para el administrador. Descarga el archivo del mes.',
};

function SelectField({ label, value, options = [], onChange }) {
  return (
    <label>
      {label}
      <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">Elegir</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AccountingPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState('siigo');
  const [credentials, setCredentials] = useState({ username: '', accessKey: '', email: '', token: '' });
  const [settings, setSettings] = useState({});
  const [period, setPeriod] = useState(currentPeriod);
  const [activity, setActivity] = useState([]);

  function applyPayload(payload) {
    const connection = payload.connection || payload;
    setData(connection);
    setProvider(connection.provider || 'siigo');
    setSettings(connection.settings || {});
    if (payload.activity) setActivity(payload.activity);
  }

  useEffect(() => {
    document.title = 'Contabilidad · Rentados';
    adminApi
      .accounting.get()
      .then(applyPayload)
      .catch((err) => setError(err.message));
  }, []);

  const selected = PROGRAMS.find((item) => item.id === provider);
  const connected = data?.status === 'connected' && data?.provider === provider;
  const fileMode = selected?.mode === 'file' || selected?.mode === 'oauth';

  async function connect(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = await adminApi.accounting.connect({ provider, credentials });
      applyPayload(payload);
      setNotice(fileMode ? 'Listo. Ya puedes descargar la cartera de cada mes.' : 'Conexión lista.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = await adminApi.accounting.saveSettings(settings);
      applyPayload(payload);
      setNotice('Quedó guardado. Las cuotas nuevas y los pagos se envían con esta configuración.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendMonth() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await adminApi.accounting.sync({ period });
      setActivity(result.activity || []);
      setNotice(`Se enviaron ${result.sent} cuotas de ${result.total}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setError('');
    try {
      const file = await adminApi.accounting.exportPeriod(period);
      const blob = new Blob([file.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError('');
    try {
      const payload = await adminApi.accounting.disconnect();
      applyPayload(payload);
      setNotice('Se desconectó el software contable.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const options = data?.provider === provider ? data.options || {} : {};

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Contabilidad</h1>
        <p>
          Enlaza el programa donde el contador lleva el conjunto. Rentados le manda la cuota de administración
          y, cuando el residente paga, el ingreso.
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {notice && <div className="admin-success">{notice}</div>}

      <form className="accounting-setup" onSubmit={connect}>
        <section className="accounting-setup__block">
          <h2>1. Elige el programa</h2>
          <div className="accounting-programs">
            {PROGRAMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`accounting-program${provider === item.id ? ' is-selected' : ''}`}
                onClick={() => setProvider(item.id)}
              >
                <strong>{item.name}</strong>
                <span>{item.summary}</span>
              </button>
            ))}
          </div>
          {selected && <p className="accounting-setup__hint">{HINTS[selected.id]}</p>}
        </section>

        {selected?.mode === 'api' && (
          <section className="accounting-card">
            <h2>2. Pega la credencial</h2>
            {provider === 'siigo' ? (
              <div className="accounting-fields">
                <label>
                  Usuario Siigo
                  <input
                    value={credentials.username}
                    onChange={(event) => setCredentials({ ...credentials, username: event.target.value })}
                    autoComplete="off"
                    required
                  />
                </label>
                <label>
                  Clave de acceso
                  <input
                    type="password"
                    value={credentials.accessKey}
                    onChange={(event) => setCredentials({ ...credentials, accessKey: event.target.value })}
                    autoComplete="off"
                    placeholder={connected ? 'Solo si vas a cambiarla' : ''}
                    required={!connected}
                  />
                </label>
              </div>
            ) : (
              <div className="accounting-fields">
                <label>
                  Correo de Alegra
                  <input
                    type="email"
                    value={credentials.email}
                    onChange={(event) => setCredentials({ ...credentials, email: event.target.value })}
                    autoComplete="off"
                    required
                  />
                </label>
                <label>
                  Token
                  <input
                    type="password"
                    value={credentials.token}
                    onChange={(event) => setCredentials({ ...credentials, token: event.target.value })}
                    autoComplete="off"
                    placeholder={connected ? 'Solo si vas a cambiarlo' : ''}
                    required={!connected}
                  />
                </label>
              </div>
            )}
            <div className="accounting-actions">
              <button type="submit" className="admin-btn" disabled={busy}>
                {busy ? 'Conectando…' : 'Probar y conectar'}
              </button>
            </div>
          </section>
        )}

        {fileMode && (
          <section className="accounting-setup__block">
            <button type="button" className="admin-btn" onClick={connect} disabled={busy}>
              Usar {selected?.name}
            </button>
          </section>
        )}
      </form>

      {connected && selected?.mode === 'api' && (
        <form className="accounting-setup" onSubmit={saveSettings}>
          <section className="accounting-card">
            <h2>3. Dile qué comprobante usar</h2>
            <p className="accounting-setup__hint">
              Conectado a {data.companyName || data.accountLabel}. Las cuotas salen a nombre de un cliente que ya
              exista en el programa. En la descripción va la torre y el apartamento.
            </p>
            {provider === 'siigo' ? (
              <div className="accounting-fields">
                <SelectField
                  label="Tipo de factura"
                  value={settings.documentTypeId}
                  options={options.documents}
                  onChange={(documentTypeId) => setSettings({ ...settings, documentTypeId })}
                />
                <SelectField
                  label="Vendedor"
                  value={settings.sellerId}
                  options={options.sellers}
                  onChange={(sellerId) => setSettings({ ...settings, sellerId })}
                />
                <SelectField
                  label="Producto o servicio"
                  value={settings.itemId}
                  options={options.items}
                  onChange={(itemId) => setSettings({ ...settings, itemId })}
                />
                <SelectField
                  label="Forma de pago"
                  value={settings.paymentTypeId}
                  options={options.paymentTypes}
                  onChange={(paymentTypeId) => setSettings({ ...settings, paymentTypeId })}
                />
                <label>
                  Identificación del cliente en Siigo
                  <input
                    value={settings.customerIdentification || ''}
                    onChange={(event) => setSettings({ ...settings, customerIdentification: event.target.value })}
                    placeholder="NIT o cédula ya creada en Siigo"
                  />
                </label>
              </div>
            ) : (
              <div className="accounting-fields">
                <SelectField
                  label="Cliente"
                  value={settings.contactId}
                  options={options.contacts}
                  onChange={(contactId) => setSettings({ ...settings, contactId })}
                />
                <SelectField
                  label="Producto o servicio"
                  value={settings.itemId}
                  options={options.items}
                  onChange={(itemId) => setSettings({ ...settings, itemId })}
                />
                <SelectField
                  label="Cuenta donde entra el pago"
                  value={settings.bankAccountId}
                  options={options.banks}
                  onChange={(bankAccountId) => setSettings({ ...settings, bankAccountId })}
                />
              </div>
            )}
            <div className="accounting-checks">
              <label>
                <input
                  type="checkbox"
                  checked={settings.sendInvoices !== false}
                  onChange={(event) => setSettings({ ...settings, sendInvoices: event.target.checked })}
                />
                Crear la cuota en el programa contable
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.sendPayments !== false}
                  onChange={(event) => setSettings({ ...settings, sendPayments: event.target.checked })}
                />
                Registrar el pago cuando el residente pague
              </label>
              {provider === 'siigo' && (
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.sendToDian)}
                    onChange={(event) => setSettings({ ...settings, sendToDian: event.target.checked })}
                  />
                  Enviar la factura a la DIAN
                </label>
              )}
            </div>
            <div className="accounting-actions">
              <button type="submit" className="admin-btn" disabled={busy}>
                Guardar
              </button>
            </div>
          </section>
        </form>
      )}

      <section className="accounting-card">
        <h2>Cartera del mes</h2>
        <label className="accounting-field accounting-field--narrow">
          Mes
          <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </label>
        <div className="accounting-actions">
          {connected && selected?.mode === 'api' && (
            <button type="button" className="admin-btn" onClick={sendMonth} disabled={busy}>
              Enviar cuotas de este mes
            </button>
          )}
          <button type="button" className="admin-btn admin-btn--ghost" onClick={download} disabled={busy}>
            Descargar archivo
          </button>
          {data?.status === 'connected' && (
            <button type="button" className="admin-btn admin-btn--ghost" onClick={disconnect} disabled={busy}>
              Desconectar
            </button>
          )}
        </div>
      </section>

      {activity.length > 0 && (
        <section>
          <h2>Últimos envíos</h2>
          <ul>
            {activity.map((item) => (
              <li key={item.id}>
                {item.status === 'sent' ? 'Enviado' : item.status === 'error' ? 'No se pudo' : 'Pendiente'}
                {' · '}
                {item.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
