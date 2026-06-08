import { useEffect, useRef, useState } from 'react';
import { porteriaApi } from '../../api/client';
import ResidentSelectField from '../../admin/components/ResidentSelectField';
import '../../admin/admin.css';
import '../PorteriaHomePage.css';

const emptyForm = {
  residentId: '',
  comment: '',
  photoUrl: '',
  cloudinaryPublicId: '',
};

export default function RegisterPackagePage() {
  const fileInputRef = useRef(null);
  const [lockerEnabled, setLockerEnabled] = useState(false);
  const [residents, setResidents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([porteriaApi.settings(), porteriaApi.residents()])
      .then(([settingsData, residentsData]) => {
        setLockerEnabled(settingsData.locker?.enabled ?? false);
        setResidents(residentsData.residents || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setError('');
    setSuccess('');

    try {
      setPhotoPreview(URL.createObjectURL(file));
      const data = await porteriaApi.lockerPackages.uploadPhoto(file);
      setForm((prev) => ({
        ...prev,
        photoUrl: data.photo.url,
        cloudinaryPublicId: data.photo.cloudinaryPublicId,
      }));
    } catch (err) {
      setPhotoPreview('');
      setError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await porteriaApi.lockerPackages.create({
        residentId: form.residentId,
        comment: form.comment || undefined,
        photoUrl: form.photoUrl,
        cloudinaryPublicId: form.cloudinaryPublicId || undefined,
      });

      if (result.heldDueToOverdue) {
        setSuccess('Paquete registrado en retención por mora (sin notificar al residente).');
      } else if (result.notified) {
        setSuccess('Paquete registrado y residente notificado.');
      } else {
        setSuccess('Paquete registrado.');
      }

      setForm(emptyForm);
      setPhotoPreview('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="porteria-page">
      <header className="porteria-page__header">
        <h1>Registrar paquete</h1>
        <p>Foto, residente y comentario. El aviso llega al portal del residente.</p>
      </header>

      {error && <div className="admin-error porteria-page__alert">{error}</div>}
      {success && <div className="porteria-page__success">{success}</div>}

      {!lockerEnabled ? (
        <div className="porteria__card">
          <h2>Casillero no habilitado</h2>
          <p>El administrador debe activarlo en Admin → Portería.</p>
        </div>
      ) : (
        <div className="porteria__card">
          <form className="admin-form porteria__form" onSubmit={handleRegister}>
            <label className="admin-unit-picker-field" style={{ gridColumn: '1 / -1' }}>
              Residente
              <ResidentSelectField
                residents={residents}
                value={form.residentId}
                onChange={(residentId) => setForm({ ...form, residentId })}
                required
              />
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              Foto del paquete
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                required={!form.photoUrl}
              />
            </label>

            {photoPreview && (
              <div className="porteria__photo-preview" style={{ gridColumn: '1 / -1' }}>
                <img src={photoPreview} alt="Vista previa del paquete" />
                {uploadingPhoto && <span>Subiendo foto…</span>}
              </div>
            )}

            <label style={{ gridColumn: '1 / -1' }}>
              Comentario (opcional)
              <textarea
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Ej: Caja mediana, frágil, mensajería Servientrega…"
              />
            </label>

            <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
              <button
                type="submit"
                className="admin-btn"
                disabled={saving || uploadingPhoto || !form.photoUrl || !form.residentId}
              >
                {saving ? 'Registrando…' : 'Registrar y notificar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
