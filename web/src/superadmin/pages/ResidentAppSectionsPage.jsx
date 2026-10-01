import { useEffect, useState } from 'react';
import { platformApi } from '../../api/client';
import '../../admin/admin.css';
import './ResidentAppSectionsPage.css';

export default function ResidentAppSectionsPage() {
  const [sections, setSections] = useState([]);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState('');

  useEffect(() => {
    document.title = 'App del residente · Rentados';
    platformApi
      .residentApp()
      .then((data) => setSections(data.sections || []))
      .catch((err) => setError(err.message));
  }, []);

  async function toggle(item) {
    const next = !item.enabled;
    setError('');
    setSavingKey(item.key);
    setSections((current) =>
      current.map((row) => (row.key === item.key ? { ...row, enabled: next } : row))
    );
    try {
      const data = await platformApi.updateResidentApp({ [item.key]: next });
      setSections(data.sections || []);
    } catch (err) {
      setSections((current) =>
        current.map((row) => (row.key === item.key ? { ...row, enabled: item.enabled } : row))
      );
      setError(err.message);
    } finally {
      setSavingKey('');
    }
  }

  return (
    <div className="admin-page resident-sections">
      <header className="admin-page__header">
        <h1>App del residente</h1>
        <p>
          Elige qué ve el residente. Lo que apagues desaparece de la app en todos los conjuntos.
          Servicios y Restaurantes empiezan ocultos.
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <ul className="resident-sections__list">
        {sections.map((item) => (
          <li key={item.key} className="resident-sections__row">
            <div>
              <h2>{item.label}</h2>
              <p>{item.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={item.enabled}
              aria-label={`${item.enabled ? 'Ocultar' : 'Mostrar'} ${item.label}`}
              className={`resident-sections__switch${item.enabled ? ' is-on' : ''}`}
              disabled={savingKey === item.key}
              onClick={() => toggle(item)}
            >
              <span />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
