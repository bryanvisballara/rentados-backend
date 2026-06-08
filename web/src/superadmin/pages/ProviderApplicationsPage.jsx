import { useEffect, useState } from 'react';
import { platformApi } from '../../api/client';
import '../../admin/admin.css';

const emptyInterview = { scheduledAt: '', location: '', notes: '' };

export default function ProviderApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [interviewFor, setInterviewFor] = useState(null);
  const [interviewForm, setInterviewForm] = useState(emptyInterview);
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await platformApi.providerApplications({ status: 'pending' });
    setApplications(data.applications);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function approve(id) {
    try {
      await platformApi.approveProvider(id);
      setSuccess('Prestador aprobado.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reject(id) {
    const reason = window.prompt('Motivo del rechazo (opcional):');
    try {
      await platformApi.rejectProvider(id, { reason: reason || undefined });
      setSuccess('Solicitud rechazada.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function scheduleInterview(e) {
    e.preventDefault();
    if (!interviewFor) return;
    setSaving(true);
    setError('');
    try {
      await platformApi.createInterview(interviewFor, interviewForm);
      setSuccess('Cita agendada. El prestador la verá en su portal.');
      setInterviewFor(null);
      setInterviewForm(emptyInterview);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Solicitudes de prestadores</h1>
        <p>Autoriza aspirantes y agenda entrevistas antes de publicarlos en la app.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && (
        <div className="admin-card" style={{ background: '#dceee4', color: '#1e5a3d' }}>
          {success}
        </div>
      )}

      {interviewFor && (
        <div className="admin-card">
          <h2>Agendar entrevista</h2>
          <form className="admin-form" onSubmit={scheduleInterview}>
            <label>
              Fecha y hora
              <input
                type="datetime-local"
                value={interviewForm.scheduledAt}
                onChange={(e) => setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })}
                required
              />
            </label>
            <label>
              Lugar / enlace
              <input
                value={interviewForm.location}
                onChange={(e) => setInterviewForm({ ...interviewForm, location: e.target.value })}
                placeholder="Oficina Rentados o link de videollamada"
              />
            </label>
            <label>
              Notas
              <textarea
                value={interviewForm.notes}
                onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                rows={3}
              />
            </label>
            <div className="admin-actions">
              <button type="submit" className="admin-btn" disabled={saving}>
                {saving ? 'Guardando…' : 'Agendar cita'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => setInterviewFor(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-card admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Negocio</th>
              <th>Contacto</th>
              <th>Categorías</th>
              <th>Solicitud</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {applications.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-empty">
                  No hay solicitudes pendientes.
                </td>
              </tr>
            ) : (
              applications.map((app) => (
                <tr key={app._id}>
                  <td>
                    <strong>{app.businessName}</strong>
                    <p className="admin-empty" style={{ margin: '0.25rem 0 0' }}>
                      {app.description || '—'}
                    </p>
                  </td>
                  <td>
                    {app.userId?.firstName} {app.userId?.lastName}
                    <br />
                    {app.userId?.email}
                    <br />
                    {app.userId?.phone || '—'}
                  </td>
                  <td>
                    {(app.categoryIds || []).map((c) => c.name).join(', ') || '—'}
                  </td>
                  <td>{new Date(app.createdAt).toLocaleString()}</td>
                  <td className="admin-actions">
                    <button type="button" className="admin-btn" onClick={() => approve(app._id)}>
                      Aprobar
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost"
                      onClick={() => setInterviewFor(app._id)}
                    >
                      Entrevista
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      onClick={() => reject(app._id)}
                    >
                      Rechazar
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
