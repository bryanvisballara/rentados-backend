import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { API_BASE } from '../api/apiBase';
import { LANDING_VINCULA_WHATSAPP_HREF } from '../lib/landingLead';
import './CreateBuildingPage.css';

const STEPS = [
  'Conjunto',
  'Ubicación',
  'Tu cuenta',
  'WhatsApp',
  'Torres',
  'Apartamentos',
  'Metraje',
  'Administración',
  'Servicios',
  'Portería',
];

const SERVICE_PRESETS = [
  'Piscina',
  'Gimnasio',
  'Sauna',
  'Turco',
  'Sala de juegos',
  'Cine',
  'Salón social',
  'Zona BBQ',
  'Sala de juntas',
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyFacility(name) {
  return {
    id: uid(),
    name,
    seasonMode: 'none',
    seasonOpen: '',
    seasonClose: '',
    openStart: '06:00',
    openEnd: '22:00',
    blockWhenOverdue: true,
    bookable: false,
    pricingMode: 'free',
    hourlyRate: '',
    flatPrice: '',
    advanceDays: '1',
    blocks: [{ hours: '1', price: '' }],
  };
}

const COUNTRY_CODES = [
  { dial: '57', name: 'Colombia' },
  { dial: '52', name: 'México' },
  { dial: '54', name: 'Argentina' },
  { dial: '56', name: 'Chile' },
  { dial: '51', name: 'Perú' },
  { dial: '58', name: 'Venezuela' },
  { dial: '593', name: 'Ecuador' },
  { dial: '591', name: 'Bolivia' },
  { dial: '595', name: 'Paraguay' },
  { dial: '598', name: 'Uruguay' },
  { dial: '506', name: 'Costa Rica' },
  { dial: '507', name: 'Panamá' },
  { dial: '505', name: 'Nicaragua' },
  { dial: '504', name: 'Honduras' },
  { dial: '503', name: 'El Salvador' },
  { dial: '502', name: 'Guatemala' },
  { dial: '1', name: 'Estados Unidos / Canadá' },
  { dial: '34', name: 'España' },
];

function withCountryCode(dial, value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  const code = String(dial || '57').replace(/[^\d]/g, '') || '57';
  if (digits.startsWith(code) && digits.length > code.length + 6) return `+${digits}`;
  return `+${code}${digits}`;
}

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.6 10.7A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.1 5.4A10.8 10.8 0 0 1 12 5c5.2 0 8.8 4.2 10 7-0.5 1.2-1.4 2.6-2.6 3.8M6.1 6.6C4.2 8 2.9 10 2 12c1.2 2.8 4.8 7 10 7 1.4 0 2.7-.3 3.8-.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M2 12c1.2-2.8 4.8-7 10-7s8.8 4.2 10 7c-1.2 2.8-4.8 7-10 7s-8.8-4.2-10-7Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function emptyStaff() {
  return { id: uid(), firstName: '', lastName: '', email: '', phone: '', password: '' };
}

export default function CreateBuildingPage() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [buildingName, setBuildingName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const codeInputs = useRef([]);
  const [verificationToken, setVerificationToken] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [adminWhatsapp, setAdminWhatsapp] = useState('');
  const [adminDial, setAdminDial] = useState('57');
  const [receptionWhatsapp, setReceptionWhatsapp] = useState('');
  const [receptionDial, setReceptionDial] = useState('57');
  const [towerCount, setTowerCount] = useState('1');
  const [towers, setTowers] = useState([]);
  const [activeTower, setActiveTower] = useState('');
  const [aptDraft, setAptDraft] = useState('');
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [areaDraft, setAreaDraft] = useState('');
  const [feeMode, setFeeMode] = useState('per_sqm');
  const [feePerSqm, setFeePerSqm] = useState('');
  const [typeFees, setTypeFees] = useState({});
  const [facilities, setFacilities] = useState([]);
  const [customService, setCustomService] = useState('');
  const [openFacility, setOpenFacility] = useState('');
  const [lockerEnabled, setLockerEnabled] = useState(true);
  const [receiveWhenOverdue, setReceiveWhenOverdue] = useState(false);
  const [staff, setStaff] = useState([emptyStaff()]);

  const active = towers.find((tower) => tower.id === activeTower) || towers[0];
  const areaGroups = useMemo(() => {
    const groups = new Map();
    towers.forEach((tower) => {
      tower.units.forEach((unit) => {
        const area = String(unit.areaSqm || '').trim();
        if (!area) return;
        if (!groups.has(area)) groups.set(area, 0);
        groups.set(area, groups.get(area) + 1);
      });
    });
    return [...groups.entries()];
  }, [towers]);

  function syncTowers(count) {
    const total = Math.min(30, Math.max(1, Number(count) || 1));
    setTowers((previous) => {
      const next = previous.slice(0, total);
      while (next.length < total) {
        next.push({ id: uid(), name: `Torre ${next.length + 1}`, units: [] });
      }
      return next.map((tower, index) => ({
        ...tower,
        name: tower.name || `Torre ${index + 1}`,
      }));
    });
    setActiveTower((current) => current || '');
  }

  function validate() {
    if (step === 0 && !buildingName.trim()) return 'Escribe el nombre del conjunto.';
    if (step === 1 && (!city.trim() || !address.trim())) return 'Ciudad y dirección son obligatorias.';
    if (step === 2) {
      if (!email.includes('@')) return 'Escribe un correo válido.';
      if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
      if (password !== passwordRepeat) return 'Las contraseñas no coinciden.';
      if (!verificationToken) return 'Verifica el correo con el código que te enviamos.';
    }
    if (step === 4) {
      const count = Number(towerCount);
      if (!Number.isFinite(count) || count < 1) return 'Indica cuántas torres tiene el conjunto.';
    }
    if (step === 5 && towers.some((tower) => !tower.units.length)) {
      return 'Cada torre necesita al menos un apartamento.';
    }
    if (step === 6 && towers.some((tower) => tower.units.some((unit) => !String(unit.areaSqm || '').trim()))) {
      return 'Define los metros cuadrados de todos los apartamentos.';
    }
    if (step === 7) {
      if (feeMode === 'per_sqm' && !(Number(feePerSqm) > 0)) return 'Escribe el valor de administración por m².';
      if (feeMode === 'per_type' && areaGroups.some(([area]) => !(Number(typeFees[area]) > 0))) {
        return 'Define el valor de administración de cada tipo de apartamento.';
      }
    }
    if (step === 9) {
      const filled = staff.filter((person) => person.firstName || person.email || person.password);
      for (const person of filled) {
        if (!person.firstName.trim() || !person.lastName.trim() || !person.email.includes('@') || person.password.length < 6) {
          return 'Completa nombre, apellido, correo y contraseña de cada usuario de portería.';
        }
      }
    }
    return '';
  }

  function goNext() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError('');
    if (step === 4) {
      syncTowers(towerCount);
      setStep(5);
      return;
    }
    if (step === 7 && feeMode === 'per_type') {
      setTowers((previous) =>
        previous.map((tower) => ({
          ...tower,
          units: tower.units.map((unit) => ({
            ...unit,
            administrationFee: typeFees[String(unit.areaSqm)] || '',
          })),
        }))
      );
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  function addApartments() {
    if (!active) return;
    const numbers = aptDraft
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!numbers.length) return;
    setTowers((previous) =>
      previous.map((tower) => {
        if (tower.id !== active.id) return tower;
        const existing = new Set(tower.units.map((unit) => unit.number));
        const units = [...tower.units];
        numbers.forEach((number) => {
          if (existing.has(number)) return;
          existing.add(number);
          units.push({ id: uid(), number, areaSqm: '', administrationFee: '' });
        });
        return { ...tower, units };
      })
    );
    setAptDraft('');
  }

  function applyArea() {
    const area = areaDraft.trim();
    if (!area || !selectedUnits.length) {
      setError('Selecciona apartamentos y escribe el metraje.');
      return;
    }
    setError('');
    setTowers((previous) =>
      previous.map((tower) => ({
        ...tower,
        units: tower.units.map((unit) =>
          selectedUnits.includes(unit.id) ? { ...unit, areaSqm: area } : unit
        ),
      }))
    );
    setSelectedUnits([]);
    setAreaDraft('');
  }

  function togglePreset(name) {
    const existing = facilities.find((item) => item.name === name);
    if (existing) {
      setFacilities((previous) => previous.filter((item) => item.id !== existing.id));
      if (openFacility === existing.id) setOpenFacility('');
      return;
    }
    const created = emptyFacility(name);
    setFacilities((previous) => [...previous, created]);
    setOpenFacility(created.id);
  }

  function updateFacility(id, patch) {
    setFacilities((previous) => previous.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function sendVerificationCode() {
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setError('Escribe tu correo para enviarte el código.');
      return;
    }
    if (password.length < 6 || password !== passwordRepeat) {
      setError('Revisa la contraseña antes de enviar el código.');
      return;
    }
    setSendingCode(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/onboarding/codigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo enviar el código.');
      setCodeSent(true);
      setVerificationCode('');
      setVerificationToken('');
      window.setTimeout(() => codeInputs.current[0]?.focus(), 50);
    } catch (sendError) {
      setError(sendError.message || 'No se pudo enviar el código.');
    } finally {
      setSendingCode(false);
    }
  }

  async function confirmVerificationCode() {
    setError('');
    try {
      const response = await fetch(`${API_BASE}/onboarding/codigo/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: verificationCode.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'El código no es válido.');
      setVerificationToken(data.verificationToken || '');
    } catch (confirmError) {
      setError(confirmError.message || 'El código no es válido.');
    }
  }

  async function finish() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        buildingName: buildingName.trim(),
        city: city.trim(),
        address: address.trim(),
        email: email.trim(),
        password,
        verificationToken,
        adminWhatsapp: withCountryCode(adminDial, adminWhatsapp),
        receptionWhatsapp: withCountryCode(receptionDial, receptionWhatsapp),
        feeMode,
        feePerSqm: feeMode === 'per_sqm' ? feePerSqm : '',
        towers: towers.map((tower) => ({
          name: tower.name,
          units: tower.units.map((unit) => ({
            number: unit.number,
            areaSqm: unit.areaSqm,
            administrationFee: feeMode === 'per_type' ? typeFees[String(unit.areaSqm)] || unit.administrationFee : '',
          })),
        })),
        facilities: facilities.map((item) => ({
          name: item.name,
          seasonMode: item.seasonMode,
          seasonOpen: item.seasonOpen,
          seasonClose: item.seasonClose,
          openStart: item.openStart,
          openEnd: item.openEnd,
          blockWhenOverdue: item.blockWhenOverdue,
          bookable: item.bookable,
          pricingMode: item.bookable ? item.pricingMode : 'free',
          hourlyRate: item.hourlyRate,
          flatPrice: item.flatPrice,
          advanceDays: item.advanceDays,
          blocks: item.blocks.map((block) => {
            const hours = Number(String(block.hours || '').replace(',', '.')) || 1;
            return {
              label: `${hours} hora${hours === 1 ? '' : 's'}`,
              durationMinutes: Math.round(hours * 60),
              price: block.price,
            };
          }),
        })),
        locker: { enabled: lockerEnabled, receiveWhenOverdue },
        porteriaUsers: staff.filter((person) => person.email.trim()),
      };
      const response = await fetch(`${API_BASE}/onboarding/edificio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo crear el conjunto.');
      setDone(data);
    } catch (submitError) {
      setError(submitError.message || 'No se pudo crear el conjunto.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="setup">
        <header className="setup__bar">
          <Link to="/conocenos" className="setup__brand" aria-label="Rentados">
            <Logo size="sm" />
            <span>Rentados</span>
          </Link>
        </header>
        <section className="setup__done">
          <p className="setup__eyebrow">Listo</p>
          <h1>¡Felicidades!</h1>
          <p>
            Has configurado el 90% de tu cuenta administrativa de <strong>{buildingName}</strong>. Ya puedes entrar
            con {done.email}.
          </p>
          <p>Aún falta configurar:</p>
          <ol>
            <li>Usuario y contraseña por apartamento.</li>
            <li>Actualizar cartera.</li>
            <li>Habilitar pasarela de pagos.</li>
          </ol>
          <div className="setup__done-actions">
            <a className="setup__primary" href={LANDING_VINCULA_WHATSAPP_HREF} target="_blank" rel="noreferrer">
              Finalizar configuración
            </a>
            <Link className="setup__primary setup__primary--line" to="/admin/login">
              Iniciar sesión
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="setup">
      <header className="setup__bar">
        <Link to="/conocenos" className="setup__brand" aria-label="Rentados">
          <Logo size="sm" />
          <span>Rentados</span>
        </Link>
        <span className="setup__step-label">
          Paso {step + 1} de {STEPS.length}
        </span>
      </header>

      <div className="setup__progress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <section className="setup__card">
        <p className="setup__eyebrow">{STEPS[step]}</p>

        {step === 0 ? (
          <>
            <h1>Nombre del conjunto residencial</h1>
            <label>
              Conjunto
              <input value={buildingName} onChange={(event) => setBuildingName(event.target.value)} placeholder="Ej. Torres del Parque" />
            </label>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1>¿Dónde está el conjunto?</h1>
            <label>
              Ciudad
              <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Barranquilla" />
            </label>
            <label>
              Dirección
              <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Calle 84 # 51-20" />
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1>Crea tu acceso de administración</h1>
            <label>
              Correo
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setVerificationToken('');
                  setCodeSent(false);
                  setVerificationCode('');
                }}
                placeholder="admin@conjunto.com"
              />
            </label>
            <label>
              Contraseña
              <span className="setup__secret">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="setup__eye" aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'} onClick={() => setShowPassword((current) => !current)}>
                  <EyeIcon open={showPassword} />
                </button>
              </span>
            </label>
            <label>
              Repetir contraseña
              <span className="setup__secret">
                <input type={showPasswordRepeat ? 'text' : 'password'} value={passwordRepeat} onChange={(event) => setPasswordRepeat(event.target.value)} />
                <button type="button" className="setup__eye" aria-label={showPasswordRepeat ? 'Ocultar contraseña' : 'Ver contraseña'} onClick={() => setShowPasswordRepeat((current) => !current)}>
                  <EyeIcon open={showPasswordRepeat} />
                </button>
              </span>
            </label>
            <button type="button" className="setup__ghost" disabled={sendingCode || Boolean(verificationToken)} onClick={sendVerificationCode}>
              {verificationToken ? 'Correo verificado' : sendingCode ? 'Enviando código…' : codeSent ? 'Reenviar código' : 'Enviar código al correo'}
            </button>
            {codeSent && !verificationToken ? (
              <div className="setup__otp">
                <span>Código de 6 dígitos</span>
                <div className="setup__otp-boxes">
                  {Array.from({ length: 6 }, (_, index) => (
                    <input
                      key={index}
                      ref={(node) => {
                        codeInputs.current[index] = node;
                      }}
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      maxLength={1}
                      value={verificationCode[index] || ''}
                      aria-label={`Dígito ${index + 1}`}
                      onChange={(event) => {
                        const digit = event.target.value.replace(/\D/g, '').slice(-1);
                        const next = verificationCode.padEnd(6, ' ').split('');
                        next[index] = digit || ' ';
                        const joined = next.join('').replace(/\s/g, '');
                        setVerificationCode(joined);
                        if (digit && index < 5) codeInputs.current[index + 1]?.focus();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Backspace' && !verificationCode[index] && index > 0) {
                          codeInputs.current[index - 1]?.focus();
                        }
                      }}
                      onPaste={(event) => {
                        const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                        if (!pasted) return;
                        event.preventDefault();
                        setVerificationCode(pasted);
                        codeInputs.current[Math.min(pasted.length, 5)]?.focus();
                      }}
                    />
                  ))}
                </div>
                <button type="button" className="setup__ghost" onClick={confirmVerificationCode}>
                  Confirmar código
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1>WhatsApp del conjunto</h1>
            <label>
              WhatsApp administración
              <span className="setup__phone">
                <select className="setup__phone-code" value={adminDial} onChange={(event) => setAdminDial(event.target.value)} aria-label="Código de país administración">
                  {COUNTRY_CODES.map((country) => (
                    <option key={`admin-${country.dial}`} value={country.dial}>
                      {country.name} +{country.dial}
                    </option>
                  ))}
                </select>
                <input value={adminWhatsapp} onChange={(event) => setAdminWhatsapp(event.target.value)} placeholder="300 000 0000" inputMode="tel" />
              </span>
            </label>
            <label>
              WhatsApp recepción / portería
              <span className="setup__phone">
                <select className="setup__phone-code" value={receptionDial} onChange={(event) => setReceptionDial(event.target.value)} aria-label="Código de país portería">
                  {COUNTRY_CODES.map((country) => (
                    <option key={`reception-${country.dial}`} value={country.dial}>
                      {country.name} +{country.dial}
                    </option>
                  ))}
                </select>
                <input value={receptionWhatsapp} onChange={(event) => setReceptionWhatsapp(event.target.value)} placeholder="300 000 0000" inputMode="tel" />
              </span>
            </label>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h1>¿Cuántas torres tiene?</h1>
            <label>
              Número de torres
              <input type="number" min="1" max="30" value={towerCount} onChange={(event) => setTowerCount(event.target.value)} />
            </label>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h1>Apartamentos por torre</h1>
            <p className="setup__hint">Cada torre puede tener apartamentos distintos. Escríbelos separados por coma o uno por uno.</p>
            <div className="setup__chips">
              {towers.map((tower) => (
                <button key={tower.id} type="button" className={active?.id === tower.id ? 'is-on' : ''} onClick={() => setActiveTower(tower.id)}>
                  {tower.name}
                </button>
              ))}
            </div>
            {active ? (
              <>
                <label>
                  Nombre de la torre
                  <input
                    value={active.name}
                    onChange={(event) =>
                      setTowers((previous) =>
                        previous.map((tower) => (tower.id === active.id ? { ...tower, name: event.target.value } : tower))
                      )
                    }
                  />
                </label>
                <div className="setup__row">
                  <input value={aptDraft} onChange={(event) => setAptDraft(event.target.value)} placeholder="101, 102, 201" />
                  <button type="button" className="setup__ghost" onClick={addApartments}>
                    Añadir
                  </button>
                </div>
                <ul className="setup__list">
                  {active.units.map((unit) => (
                    <li key={unit.id}>
                      <span>Apto {unit.number}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setTowers((previous) =>
                            previous.map((tower) =>
                              tower.id === active.id
                                ? { ...tower, units: tower.units.filter((item) => item.id !== unit.id) }
                                : tower
                            )
                          )
                        }
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : null}

        {step === 6 ? (
          <>
            <h1>Metros cuadrados por apartamento</h1>
            <p className="setup__hint">Selecciona varios apartamentos del mismo tamaño y asígnales el metraje de una vez.</p>
            <div className="setup__chips">
              {towers.map((tower) => (
                <button key={tower.id} type="button" className={active?.id === tower.id ? 'is-on' : ''} onClick={() => setActiveTower(tower.id)}>
                  {tower.name}
                </button>
              ))}
            </div>
            {active ? (
              <ul className="setup__list">
                {active.units.map((unit) => (
                  <li key={unit.id}>
                    <label className="setup__check">
                      <input
                        type="checkbox"
                        checked={selectedUnits.includes(unit.id)}
                        onChange={(event) =>
                          setSelectedUnits((previous) =>
                            event.target.checked ? [...previous, unit.id] : previous.filter((id) => id !== unit.id)
                          )
                        }
                      />
                      Apto {unit.number}
                    </label>
                    <strong>{unit.areaSqm ? `${unit.areaSqm} m²` : 'Sin metraje'}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="setup__row">
              <input value={areaDraft} onChange={(event) => setAreaDraft(event.target.value)} placeholder="Ej. 89" />
              <button type="button" className="setup__ghost" onClick={applyArea}>
                Aplicar m²
              </button>
            </div>
          </>
        ) : null}

        {step === 7 ? (
          <>
            <h1>Valor de administración</h1>
            <div className="setup__chips">
              <button type="button" className={feeMode === 'per_sqm' ? 'is-on' : ''} onClick={() => setFeeMode('per_sqm')}>
                Por m²
              </button>
              <button type="button" className={feeMode === 'per_type' ? 'is-on' : ''} onClick={() => setFeeMode('per_type')}>
                Por tipo de apto
              </button>
            </div>
            {feeMode === 'per_sqm' ? (
              <label>
                Valor por m² (COP)
                <input value={feePerSqm} onChange={(event) => setFeePerSqm(event.target.value)} placeholder="8500" />
              </label>
            ) : (
              areaGroups.map(([area, count]) => (
                <label key={area}>
                  {area} m² · {count} apto{count === 1 ? '' : 's'}
                  <input
                    value={typeFees[area] || ''}
                    onChange={(event) => setTypeFees((previous) => ({ ...previous, [area]: event.target.value }))}
                    placeholder="Cuota mensual"
                  />
                </label>
              ))
            )}
          </>
        ) : null}

        {step === 8 ? (
          <>
            <h1>¿Qué servicios ofrece tu conjunto?</h1>
            <div className="setup__chips">
              {SERVICE_PRESETS.map((name) => (
                <button key={name} type="button" className={facilities.some((item) => item.name === name) ? 'is-on' : ''} onClick={() => togglePreset(name)}>
                  {name}
                </button>
              ))}
            </div>
            <div className="setup__row">
              <input value={customService} onChange={(event) => setCustomService(event.target.value)} placeholder="Crear otro servicio" />
              <button
                type="button"
                className="setup__ghost"
                onClick={() => {
                  const name = customService.trim();
                  if (!name) return;
                  const created = emptyFacility(name);
                  setFacilities((previous) => [...previous, created]);
                  setOpenFacility(created.id);
                  setCustomService('');
                }}
              >
                Crear servicio
              </button>
            </div>
            {facilities.map((facility) => (
              <article key={facility.id} className="setup__service">
                <button type="button" className="setup__service-title" onClick={() => setOpenFacility(openFacility === facility.id ? '' : facility.id)}>
                  {facility.name}
                </button>
                {openFacility === facility.id ? (
                  <div className="setup__service-body">
                    <div className="setup__chips">
                      <button type="button" className={facility.seasonMode === 'season' ? 'is-on' : ''} onClick={() => updateFacility(facility.id, { seasonMode: 'season' })}>
                        Con temporada
                      </button>
                      <button type="button" className={facility.seasonMode === 'none' ? 'is-on' : ''} onClick={() => updateFacility(facility.id, { seasonMode: 'none' })}>
                        Sin temporada
                      </button>
                    </div>
                    {facility.seasonMode === 'season' ? (
                      <div className="setup__row">
                        <label>
                          Apertura
                          <input type="date" value={facility.seasonOpen} onChange={(event) => updateFacility(facility.id, { seasonOpen: event.target.value })} />
                        </label>
                        <label>
                          Cierre
                          <input type="date" value={facility.seasonClose} onChange={(event) => updateFacility(facility.id, { seasonClose: event.target.value })} />
                        </label>
                      </div>
                    ) : null}
                    <div className="setup__row">
                      <label>
                        Hora de apertura
                        <input type="time" value={facility.openStart} onChange={(event) => updateFacility(facility.id, { openStart: event.target.value })} />
                      </label>
                      <label>
                        Hora de cierre
                        <input type="time" value={facility.openEnd} onChange={(event) => updateFacility(facility.id, { openEnd: event.target.value })} />
                      </label>
                    </div>
                    <label className="setup__check">
                      <input type="checkbox" checked={facility.blockWhenOverdue} onChange={(event) => updateFacility(facility.id, { blockWhenOverdue: event.target.checked })} />
                      Suspender si hay mora
                    </label>
                    <label className="setup__check">
                      <input type="checkbox" checked={facility.bookable} onChange={(event) => updateFacility(facility.id, { bookable: event.target.checked })} />
                      Es reservable
                    </label>
                    {facility.bookable ? (
                      <>
                        <div className="setup__chips">
                          {[
                            ['free', 'Gratis'],
                            ['hourly', 'Por hora'],
                            ['blocks', 'Paquetes de hora'],
                            ['flat', 'Tarifa fija'],
                          ].map(([value, label]) => (
                            <button key={value} type="button" className={facility.pricingMode === value ? 'is-on' : ''} onClick={() => updateFacility(facility.id, { pricingMode: value })}>
                              {label}
                            </button>
                          ))}
                        </div>
                        {facility.pricingMode === 'hourly' ? (
                          <label>
                            Valor por hora
                            <input value={facility.hourlyRate} onChange={(event) => updateFacility(facility.id, { hourlyRate: event.target.value })} />
                          </label>
                        ) : null}
                        {facility.pricingMode === 'flat' ? (
                          <label>
                            Tarifa por reserva
                            <input value={facility.flatPrice} onChange={(event) => updateFacility(facility.id, { flatPrice: event.target.value })} />
                          </label>
                        ) : null}
                        {facility.pricingMode === 'blocks' ? (
                          <div className="setup__packages">
                            {facility.blocks.map((block, index) => (
                              <div className="setup__package" key={`${facility.id}-block-${index}`}>
                                <label>
                                  ¿Cuántas horas?
                                  <input
                                    value={block.hours}
                                    inputMode="decimal"
                                    onChange={(event) => {
                                      const blocks = facility.blocks.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, hours: event.target.value } : item
                                      );
                                      updateFacility(facility.id, { blocks });
                                    }}
                                    placeholder="2"
                                  />
                                </label>
                                <label>
                                  Precio del paquete
                                  <input
                                    value={block.price}
                                    onChange={(event) => {
                                      const blocks = facility.blocks.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, price: event.target.value } : item
                                      );
                                      updateFacility(facility.id, { blocks });
                                    }}
                                    placeholder="50000"
                                  />
                                </label>
                                {facility.blocks.length > 1 ? (
                                  <button
                                    type="button"
                                    className="setup__ghost"
                                    onClick={() =>
                                      updateFacility(facility.id, {
                                        blocks: facility.blocks.filter((_, itemIndex) => itemIndex !== index),
                                      })
                                    }
                                  >
                                    Quitar paquete
                                  </button>
                                ) : null}
                              </div>
                            ))}
                            <button
                              type="button"
                              className="setup__ghost"
                              onClick={() =>
                                updateFacility(facility.id, {
                                  blocks: [...facility.blocks, { hours: '', price: '' }],
                                })
                              }
                            >
                              Añadir paquete
                            </button>
                          </div>
                        ) : null}
                        <label>
                          Días de anticipación
                          <input value={facility.advanceDays} onChange={(event) => updateFacility(facility.id, { advanceDays: event.target.value })} />
                        </label>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </>
        ) : null}

        {step === 9 ? (
          <>
            <h1>Portería y casillero</h1>
            <label className="setup__check">
              <input type="checkbox" checked={lockerEnabled} onChange={(event) => setLockerEnabled(event.target.checked)} />
              Habilitar casillero de paquetes en el portal de portería
            </label>
            <label className="setup__check">
              <input type="checkbox" checked={receiveWhenOverdue} onChange={(event) => setReceiveWhenOverdue(event.target.checked)} />
              Recibir paquetes de unidades en mora
            </label>
            <h2>Usuarios de portería</h2>
            {staff.map((person) => (
              <div key={person.id} className="setup__service">
                <label>
                  Nombre
                  <input value={person.firstName} onChange={(event) => setStaff((previous) => previous.map((item) => (item.id === person.id ? { ...item, firstName: event.target.value } : item)))} />
                </label>
                <label>
                  Apellido
                  <input value={person.lastName} onChange={(event) => setStaff((previous) => previous.map((item) => (item.id === person.id ? { ...item, lastName: event.target.value } : item)))} />
                </label>
                <label>
                  Correo
                  <input value={person.email} onChange={(event) => setStaff((previous) => previous.map((item) => (item.id === person.id ? { ...item, email: event.target.value } : item)))} />
                </label>
                <label>
                  Teléfono
                  <input value={person.phone} onChange={(event) => setStaff((previous) => previous.map((item) => (item.id === person.id ? { ...item, phone: event.target.value } : item)))} />
                </label>
                <label>
                  Contraseña
                  <input type="password" value={person.password} onChange={(event) => setStaff((previous) => previous.map((item) => (item.id === person.id ? { ...item, password: event.target.value } : item)))} />
                </label>
              </div>
            ))}
            <button type="button" className="setup__ghost" onClick={() => setStaff((previous) => [...previous, emptyStaff()])}>
              Añadir otro
            </button>
          </>
        ) : null}

        {error ? <p className="setup__error">{error}</p> : null}

        <div className="setup__actions">
          {step > 0 ? (
            <button type="button" className="setup__ghost" onClick={() => { setError(''); setStep((current) => current - 1); }}>
              Atrás
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="setup__primary" onClick={goNext}>
              Continuar
            </button>
          ) : (
            <button type="button" className="setup__primary" disabled={busy} onClick={finish}>
              {busy ? 'Creando…' : 'Finalizar'}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
