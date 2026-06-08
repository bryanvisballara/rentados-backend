import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatMoney, platformApi } from '../../api/client';
import '../../admin/admin.css';
import './ShopPage.css';

const emptyCategory = { name: '', slug: '', description: '', sortOrder: '0' };
const emptyItem = {
  name: '',
  slug: '',
  description: '',
  categoryId: '',
  price: '',
  compareAtPrice: '',
  sortOrder: '0',
  isAvailable: true,
  isFeatured: false,
  imageUrl: '',
  tags: '',
};

export default function RestaurantMenuPage() {
  const { restaurantId } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [section, setSection] = useState('items');
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [itemImages, setItemImages] = useState([]);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadAll() {
    const [restaurantData, categoriesData, itemsData] = await Promise.all([
      platformApi.restaurant(restaurantId),
      platformApi.restaurantMenuCategories(restaurantId),
      platformApi.restaurantMenuItems(restaurantId),
    ]);
    setRestaurant(restaurantData.restaurant);
    setCategories(categoriesData.categories);
    setItems(itemsData.items);
  }

  useEffect(() => {
    loadAll().catch((err) => setError(err.message));
  }, [restaurantId]);

  function resetCategoryForm() {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategory);
  }

  function resetItemForm() {
    setEditingItemId(null);
    setItemForm(emptyItem);
    setItemImages([]);
  }

  async function handleCategorySubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    const body = {
      name: categoryForm.name.trim(),
      slug: categoryForm.slug.trim() || undefined,
      description: categoryForm.description.trim() || undefined,
      sortOrder: Number(categoryForm.sortOrder) || 0,
    };
    try {
      if (editingCategoryId) {
        await platformApi.updateRestaurantMenuCategory(editingCategoryId, body);
        setSuccess('Categoría actualizada.');
      } else {
        await platformApi.createRestaurantMenuCategory(restaurantId, body);
        setSuccess('Categoría creada.');
      }
      resetCategoryForm();
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleItemSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!itemForm.categoryId) {
      setError('Selecciona una categoría.');
      return;
    }

    const images = [...itemImages];
    if (itemForm.imageUrl.trim()) {
      images.push({ url: itemForm.imageUrl.trim(), sortOrder: images.length });
    }

    const body = {
      name: itemForm.name.trim(),
      slug: itemForm.slug.trim() || undefined,
      description: itemForm.description.trim() || undefined,
      categoryId: itemForm.categoryId,
      price: Number(itemForm.price),
      compareAtPrice: itemForm.compareAtPrice ? Number(itemForm.compareAtPrice) : undefined,
      currency: restaurant?.currency || 'COP',
      images,
      tags: itemForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      isAvailable: itemForm.isAvailable,
      isFeatured: itemForm.isFeatured,
      sortOrder: Number(itemForm.sortOrder) || 0,
    };

    try {
      if (editingItemId) {
        await platformApi.updateRestaurantMenuItem(editingItemId, body);
        setSuccess('Plato actualizado.');
      } else {
        await platformApi.createRestaurantMenuItem(restaurantId, body);
        setSuccess('Plato publicado.');
      }
      resetItemForm();
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deactivateCategory(id) {
    if (!window.confirm('¿Desactivar esta categoría?')) return;
    try {
      await platformApi.removeRestaurantMenuCategory(id);
      setSuccess('Categoría desactivada.');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deactivateItem(id) {
    if (!window.confirm('¿Desactivar este plato?')) return;
    try {
      await platformApi.removeRestaurantMenuItem(id);
      setSuccess('Plato desactivado.');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const data = await platformApi.uploadRestaurantMenuItemImage(restaurantId, file);
      setItemImages((prev) => [
        ...prev,
        { url: data.image.url, cloudinaryPublicId: data.image.cloudinaryPublicId, sortOrder: prev.length },
      ]);
      setSuccess('Imagen subida.');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function startEditCategory(category) {
    setSection('categories');
    setEditingCategoryId(category._id);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      sortOrder: String(category.sortOrder ?? 0),
    });
  }

  function startEditItem(item) {
    setSection('items');
    setEditingItemId(item._id);
    setItemForm({
      name: item.name,
      slug: item.slug,
      description: item.description || '',
      categoryId: item.categoryId?._id || item.categoryId || '',
      price: String(item.price ?? ''),
      compareAtPrice: item.compareAtPrice != null ? String(item.compareAtPrice) : '',
      sortOrder: String(item.sortOrder ?? 0),
      isAvailable: item.isAvailable !== false,
      isFeatured: Boolean(item.isFeatured),
      imageUrl: '',
      tags: (item.tags || []).join(', '),
    });
    setItemImages(item.images || []);
  }

  const activeCategories = categories.filter((item) => item.isActive !== false);
  const activeItems = items.filter((item) => item.isActive !== false);

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <Link to="/super-admin/restaurantes" className="app-adoption-back">
          ← Restaurantes
        </Link>
        <h1>{restaurant?.name || 'Menú'}</h1>
        <p>Gestiona categorías y platos del restaurante propio de Rentados.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-success">{success}</div>}

      <div className="shop-page__toolbar">
        <div className="shop-page__tabs">
          <button
            type="button"
            className={`shop-page__tab ${section === 'items' ? 'is-active' : ''}`}
            onClick={() => setSection('items')}
          >
            Platos · {activeItems.length}
          </button>
          <button
            type="button"
            className={`shop-page__tab ${section === 'categories' ? 'is-active' : ''}`}
            onClick={() => setSection('categories')}
          >
            Categorías · {activeCategories.length}
          </button>
        </div>
      </div>

      {section === 'categories' && (
        <>
          <div className="shop-editor">
            <div className="shop-editor__head">
              <h2>{editingCategoryId ? 'Editar categoría' : 'Nueva categoría'}</h2>
            </div>
            <form className="shop-form shop-form--category" onSubmit={handleCategorySubmit}>
              <div className="shop-field-row">
                <label className="shop-field">
                  <span className="shop-field__label">Nombre</span>
                  <input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    required
                  />
                </label>
                <label className="shop-field">
                  <span className="shop-field__label">Slug</span>
                  <input
                    value={categoryForm.slug}
                    onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                  />
                </label>
              </div>
              <label className="shop-field">
                <span className="shop-field__label">Descripción</span>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows={2}
                />
              </label>
              <label className="shop-field">
                <span className="shop-field__label">Orden</span>
                <input
                  type="number"
                  value={categoryForm.sortOrder}
                  onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: e.target.value })}
                />
              </label>
              <div className="shop-form__bar">
                <button type="submit" className="admin-btn">
                  {editingCategoryId ? 'Guardar' : 'Crear categoría'}
                </button>
                {editingCategoryId && (
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={resetCategoryForm}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="admin-card admin-table-wrap shop-table-card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Categoría</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {activeCategories.map((category) => (
                  <tr key={category._id}>
                    <td>{category.sortOrder ?? 0}</td>
                    <td>
                      <strong>{category.name}</strong>
                      {category.description && (
                        <span className="shop-product-cell__meta">{category.description}</span>
                      )}
                    </td>
                    <td className="admin-actions">
                      <button type="button" className="admin-btn admin-btn--ghost" onClick={() => startEditCategory(category)}>
                        Editar
                      </button>
                      <button type="button" className="admin-btn admin-btn--danger" onClick={() => deactivateCategory(category._id)}>
                        Desactivar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {section === 'items' && (
        <>
          <div className="shop-editor">
            <div className="shop-editor__head">
              <h2>{editingItemId ? 'Editar plato' : 'Nuevo plato'}</h2>
            </div>
            <form className="shop-form shop-form--category" onSubmit={handleItemSubmit}>
              <div className="shop-field-row">
                <label className="shop-field">
                  <span className="shop-field__label">Nombre</span>
                  <input
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    required
                  />
                </label>
                <label className="shop-field">
                  <span className="shop-field__label">Categoría</span>
                  <select
                    value={itemForm.categoryId}
                    onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar…</option>
                    {activeCategories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="shop-field">
                <span className="shop-field__label">Descripción</span>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  rows={2}
                />
              </label>
              <div className="shop-field-row">
                <label className="shop-field">
                  <span className="shop-field__label">Precio</span>
                  <input
                    type="number"
                    min="0"
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                    required
                  />
                </label>
                <label className="shop-field">
                  <span className="shop-field__label">Precio anterior</span>
                  <input
                    type="number"
                    min="0"
                    value={itemForm.compareAtPrice}
                    onChange={(e) => setItemForm({ ...itemForm, compareAtPrice: e.target.value })}
                  />
                </label>
              </div>
              <label className="shop-field">
                <span className="shop-field__label">Etiquetas</span>
                <input
                  value={itemForm.tags}
                  onChange={(e) => setItemForm({ ...itemForm, tags: e.target.value })}
                  placeholder="vegetariano, picante"
                />
              </label>
              {itemImages.length > 0 && (
                <div className="shop-gallery">
                  {itemImages.map((image, index) => (
                    <div key={image.url} className="shop-gallery__item">
                      <img src={image.url} alt="" />
                      <button type="button" className="shop-gallery__remove" onClick={() => setItemImages((prev) => prev.filter((_, i) => i !== index))}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="shop-upload">
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                <span className="shop-upload__title">{uploading ? 'Subiendo…' : 'Subir foto del plato'}</span>
              </label>
              <label className="shop-check">
                <input
                  type="checkbox"
                  checked={itemForm.isAvailable}
                  onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
                />
                <span>Disponible</span>
              </label>
              <div className="shop-form__bar">
                <button type="submit" className="admin-btn">
                  {editingItemId ? 'Guardar plato' : 'Publicar plato'}
                </button>
                {editingItemId && (
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={resetItemForm}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="admin-card admin-table-wrap shop-table-card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Plato</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="admin-empty">
                      No hay platos en el menú.
                    </td>
                  </tr>
                ) : (
                  activeItems.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <div className="shop-product-cell">
                          {item.images?.[0]?.url && (
                            <img src={item.images[0].url} alt="" className="shop-product-cell__thumb" />
                          )}
                          <div>
                            <span className="shop-product-cell__name">{item.name}</span>
                            <span className="shop-product-cell__meta">{item.description}</span>
                          </div>
                        </div>
                      </td>
                      <td>{item.categoryId?.name || '—'}</td>
                      <td>{formatMoney(item.price, item.currency || restaurant?.currency || 'COP')}</td>
                      <td>{item.isAvailable !== false ? 'Disponible' : 'Agotado'}</td>
                      <td className="admin-actions">
                        <button type="button" className="admin-btn admin-btn--ghost" onClick={() => startEditItem(item)}>
                          Editar
                        </button>
                        <button type="button" className="admin-btn admin-btn--danger" onClick={() => deactivateItem(item._id)}>
                          Desactivar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
