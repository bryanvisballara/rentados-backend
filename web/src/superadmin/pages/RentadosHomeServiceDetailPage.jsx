import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { platformApi } from '../../api/client';
import '../../admin/admin.css';

const emptyMember = {
  name: '',
  memberType: 'person',
  tagline: '',
  resume: '',
  sortOrder: '0',
  isActive: true,
};

export default function RentadosHomeServiceDetailPage() {
  const { serviceId } = useParams();
  const [service, setService] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [editingMemberId, setEditingMemberId] = useState('');
  const [uploadingMemberId, setUploadingMemberId] = useState('');

  async function load() {
    const data = await platformApi.homeServices.get(serviceId);
    setService(data.service);
    setMembers(data.members || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [serviceId]);

  async function saveService() {
    setError('');
    try {
      const data = await platformApi.homeServices.update(serviceId, {
        name: service.name,
        description: service.description,
        isActive: service.isActive,
      });
      setService(data.service);
      setSaved('Servicio guardado.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadServiceImage(file) {
    if (!file) return;
    try {
      const data = await platformApi.homeServices.uploadImage(serviceId, file);
      setService(data.service);
      setSaved('Imagen del servicio actualizada.');
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditMember(member) {
    setEditingMemberId(member.id);
    setMemberForm({
      name: member.name,
      memberType: member.memberType || 'person',
      tagline: member.tagline || '',
      resume: member.resume || '',
      sortOrder: String(member.sortOrder ?? 0),
      isActive: member.isActive !== false,
    });
  }

  async function saveMember(e) {
    e.preventDefault();
    setError('');
    const body = {
      name: memberForm.name.trim(),
      memberType: memberForm.memberType,
      tagline: memberForm.tagline.trim(),
      resume: memberForm.resume.trim(),
      sortOrder: Number(memberForm.sortOrder) || 0,
      isActive: memberForm.isActive,
    };

    try {
      if (editingMemberId) {
        await platformApi.homeServices.updateMember(serviceId, editingMemberId, body);
      } else {
        await platformApi.homeServices.createMember(serviceId, body);
      }
      setMemberForm(emptyMember);
      setEditingMemberId('');
      await load();
      setSaved('Perfil guardado.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeMember(memberId) {
    if (!window.confirm('¿Eliminar este perfil?')) return;
    try {
      await platformApi.homeServices.removeMember(serviceId, memberId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadMemberMedia(memberId, file) {
    if (!file) return;
    setUploadingMemberId(memberId);
    try {
      await platformApi.homeServices.uploadMemberMedia(serviceId, memberId, file);
      await load();
      setSaved('Archivo agregado al perfil.');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingMemberId('');
    }
  }

  async function removeMemberMedia(memberId, mediaId) {
    try {
      await platformApi.homeServices.removeMemberMedia(serviceId, memberId, mediaId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!service) {
    return (
      <div className="admin-page">
        {error ? <div className="admin-error">{error}</div> : <p className="admin-empty">Cargando…</p>}
      </div>
    );
  }

  return (
    <div className="admin-page">
      <p>
        <Link to="/super-admin/servicios-rentados">← Servicios Rentados</Link>
      </p>

      <header className="admin-page__header">
        <h1>{service.name}</h1>
        <p>Personas y empresas que prestan este servicio en nombre de Rentados.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {saved && (
        <div className="admin-card" style={{ background: '#dceee4', color: '#1e5a3d' }}>
          {saved}
        </div>
      )}

      <div className="admin-card">
        <h2>Datos del servicio</h2>
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            saveService();
          }}
        >
          <label>
            Nombre
            <input
              value={service.name}
              onChange={(e) => setService({ ...service, name: e.target.value })}
              required
            />
          </label>
          <label>
            Descripción
            <textarea
              rows={3}
              value={service.description || ''}
              onChange={(e) => setService({ ...service, description: e.target.value })}
            />
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={service.isActive !== false}
              onChange={(e) => setService({ ...service, isActive: e.target.checked })}
            />
            Visible para residentes
          </label>
          <label>
            Imagen de portada
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                uploadServiceImage(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <button type="submit" className="admin-btn">
            Guardar servicio
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2>{editingMemberId ? 'Editar perfil' : 'Agregar persona o empresa'}</h2>
        <form className="admin-form" onSubmit={saveMember}>
          <label>
            Nombre
            <input
              value={memberForm.name}
              onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
              required
            />
          </label>
          <label>
            Tipo
            <select
              value={memberForm.memberType}
              onChange={(e) => setMemberForm({ ...memberForm, memberType: e.target.value })}
            >
              <option value="person">Persona</option>
              <option value="company">Empresa</option>
            </select>
          </label>
          <label>
            Resumen corto
            <input
              value={memberForm.tagline}
              onChange={(e) => setMemberForm({ ...memberForm, tagline: e.target.value })}
              placeholder="Ej: 8 años de experiencia en aseo residencial"
            />
          </label>
          <label>
            Hoja de vida
            <textarea
              rows={6}
              value={memberForm.resume}
              onChange={(e) => setMemberForm({ ...memberForm, resume: e.target.value })}
              placeholder="Experiencia, certificaciones, referencias…"
            />
          </label>
          <label>
            Orden
            <input
              type="number"
              value={memberForm.sortOrder}
              onChange={(e) => setMemberForm({ ...memberForm, sortOrder: e.target.value })}
            />
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={memberForm.isActive}
              onChange={(e) => setMemberForm({ ...memberForm, isActive: e.target.checked })}
            />
            Visible
          </label>
          <div className="admin-actions">
            <button type="submit" className="admin-btn">
              {editingMemberId ? 'Guardar perfil' : 'Agregar perfil'}
            </button>
            {editingMemberId && (
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  setEditingMemberId('');
                  setMemberForm(emptyMember);
                }}
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="admin-card">
        <h2>Perfiles ({members.length})</h2>
        {members.length === 0 ? (
          <p className="admin-empty">Aún no hay personas ni empresas en este servicio.</p>
        ) : (
          members.map((member) => (
            <article key={member.id} className="admin-card" style={{ marginTop: '0.75rem' }}>
              <div className="admin-actions" style={{ justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0 }}>
                    {member.name}{' '}
                    <span style={{ fontWeight: 400, fontSize: '0.8125rem', color: '#6b655c' }}>
                      · {member.memberType === 'company' ? 'Empresa' : 'Persona'}
                    </span>
                  </h3>
                  {member.tagline && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>{member.tagline}</p>
                  )}
                </div>
                <div className="admin-actions">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => startEditMember(member)}>
                    Editar
                  </button>
                  <button type="button" className="admin-btn admin-btn--danger" onClick={() => removeMember(member.id)}>
                    Eliminar
                  </button>
                </div>
              </div>

              {member.resume && (
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    fontSize: '0.8125rem',
                    margin: '0.75rem 0 0',
                    background: '#f5f2ed',
                    padding: '0.75rem',
                    borderRadius: '8px',
                  }}
                >
                  {member.resume}
                </pre>
              )}

              <div className="admin-home-service-media-grid" style={{ marginTop: '0.75rem' }}>
                {(member.media || []).map((item) => {
                  const mediaId = item._id || item.id;
                  return (
                  <div key={mediaId || item.url} className="admin-home-service-media-item">
                    {item.type === 'video' ? (
                      <video src={item.url} controls poster={item.thumbnailUrl} />
                    ) : (
                      <img src={item.url} alt="" />
                    )}
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost"
                      onClick={() => removeMemberMedia(member.id, mediaId)}
                    >
                      Quitar
                    </button>
                  </div>
                  );
                })}
              </div>

              <label style={{ display: 'block', marginTop: '0.75rem' }}>
                Subir foto o video
                <input
                  type="file"
                  accept="image/*,video/*"
                  disabled={uploadingMemberId === member.id}
                  onChange={(e) => {
                    uploadMemberMedia(member.id, e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
