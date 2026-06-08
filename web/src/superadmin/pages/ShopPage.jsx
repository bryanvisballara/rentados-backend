import { useEffect, useState } from 'react';
import { platformApi, formatMoney } from '../../api/client';
import '../../admin/admin.css';
import './ShopPage.css';

const SHOP_COUNTRIES = [
  { value: 'Colombia', label: 'Colombia', currency: 'COP' },
  { value: 'México', label: 'México', currency: 'MXN' },
];

function getCountryCurrency(country) {
  return SHOP_COUNTRIES.find((item) => item.value === country)?.currency || 'COP';
}

function resolveProductCountry(product) {
  if (product.currency === 'MXN') return 'México';
  const countries = product.targetCountries || [];
  if (countries.some((value) => value.toLowerCase().includes('mex'))) return 'México';
  if (countries[0]) return countries[0];
  return 'Colombia';
}

const emptyCategory = {
  name: '',
  slug: '',
  description: '',
  icon: '',
  sortOrder: '0',
};

const emptyProduct = {
  name: '',
  slug: '',
  shortDescription: '',
  description: '',
  categoryId: '',
  price: '',
  compareAtPrice: '',
  sku: '',
  stock: '',
  country: 'Colombia',
  isFeatured: false,
  sortOrder: '0',
  imageUrl: '',
};

export default function ShopPage() {
  const [section, setSection] = useState('products');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [productImages, setProductImages] = useState([]);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadCategories() {
    const data = await platformApi.shopCategories();
    setCategories(data.categories);
  }

  async function loadProducts() {
    const data = await platformApi.shopProducts();
    setProducts(data.products);
  }

  async function loadAll() {
    await Promise.all([loadCategories(), loadProducts()]);
  }

  useEffect(() => {
    loadAll().catch((err) => setError(err.message));
  }, []);

  function resetCategoryForm() {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategory);
  }

  function resetProductForm() {
    setEditingProductId(null);
    setProductForm(emptyProduct);
    setProductImages([]);
  }

  function startEditCategory(category) {
    setSection('categories');
    setEditingCategoryId(category._id);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      icon: category.icon || '',
      sortOrder: String(category.sortOrder ?? 0),
    });
  }

  function startEditProduct(product) {
    setSection('products');
    setEditingProductId(product._id);
    setProductForm({
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription || '',
      description: product.description || '',
      categoryId: product.categoryId?._id || product.categoryId || '',
      price: String(product.price ?? ''),
      compareAtPrice: product.compareAtPrice != null ? String(product.compareAtPrice) : '',
      sku: product.sku || '',
      stock: product.stock != null ? String(product.stock) : '',
      country: resolveProductCountry(product),
      isFeatured: Boolean(product.isFeatured),
      sortOrder: String(product.sortOrder ?? 0),
      imageUrl: '',
    });
    setProductImages(product.images || []);
  }

  async function handleCategorySubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const body = {
      name: categoryForm.name.trim(),
      slug: categoryForm.slug.trim() || undefined,
      description: categoryForm.description.trim() || undefined,
      icon: categoryForm.icon.trim() || undefined,
      sortOrder: Number(categoryForm.sortOrder) || 0,
    };

    try {
      if (editingCategoryId) {
        await platformApi.updateShopCategory(editingCategoryId, body);
        setSuccess('Categoría actualizada.');
      } else {
        await platformApi.createShopCategory(body);
        setSuccess('Categoría creada.');
      }
      resetCategoryForm();
      await loadCategories();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleProductSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!productForm.categoryId) {
      setError('Selecciona una categoría.');
      return;
    }

    const images = [...productImages];
    if (productForm.imageUrl.trim()) {
      images.push({ url: productForm.imageUrl.trim(), sortOrder: images.length });
    }

    const currency = getCountryCurrency(productForm.country);

    const body = {
      name: productForm.name.trim(),
      slug: productForm.slug.trim() || undefined,
      shortDescription: productForm.shortDescription.trim() || undefined,
      description: productForm.description.trim() || undefined,
      categoryId: productForm.categoryId,
      price: Number(productForm.price),
      compareAtPrice: productForm.compareAtPrice ? Number(productForm.compareAtPrice) : undefined,
      currency,
      sku: productForm.sku.trim() || undefined,
      stock: productForm.stock !== '' ? Number(productForm.stock) : undefined,
      targetCountries: [productForm.country],
      targetCities: [],
      isFeatured: productForm.isFeatured,
      sortOrder: Number(productForm.sortOrder) || 0,
      images,
    };

    try {
      if (editingProductId) {
        await platformApi.updateShopProduct(editingProductId, body);
        setSuccess('Producto actualizado.');
      } else {
        await platformApi.createShopProduct(body);
        setSuccess('Producto publicado.');
      }
      resetProductForm();
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deactivateCategory(id) {
    if (!window.confirm('¿Desactivar esta categoría?')) return;
    try {
      await platformApi.removeShopCategory(id);
      setSuccess('Categoría desactivada.');
      await loadCategories();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deactivateProduct(id) {
    if (!window.confirm('¿Desactivar este producto?')) return;
    try {
      await platformApi.removeShopProduct(id);
      setSuccess('Producto desactivado.');
      await loadProducts();
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
      const data = await platformApi.uploadShopProductImage(file);
      setProductImages((prev) => [
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

  function removeImage(index) {
    setProductImages((prev) => prev.filter((_, i) => i !== index));
  }

  const activeCategories = categories.filter((c) => c.isActive !== false);
  const activeProducts = products.filter((p) => p.isActive !== false);
  const productCurrency = getCountryCurrency(productForm.country);

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Shop — Productos hogar</h1>
        <p>
          Catálogo de productos para residentes (cocina, limpieza, organización). Filtra por país y
          ciudad; vacío = visible en todos los conjuntos.
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-success">{success}</div>}

      <div className="shop-page__toolbar">
        <div className="shop-page__tabs">
          <button
            type="button"
            className={`shop-page__tab ${section === 'products' ? 'is-active' : ''}`}
            onClick={() => setSection('products')}
          >
            Productos · {activeProducts.length}
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
              <p>Agrupa los productos del shop (cocina, limpieza, organización, etc.).</p>
            </div>
            <form className="shop-form shop-form--category" onSubmit={handleCategorySubmit}>
              <div className="shop-field-row">
                <label className="shop-field">
                  <span className="shop-field__label">Nombre</span>
                  <input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    placeholder="Ej: Cocina"
                    required
                  />
                </label>
                <label className="shop-field">
                  <span className="shop-field__label">Slug</span>
                  <span className="shop-field__hint">Opcional · se genera automáticamente</span>
                  <input
                    value={categoryForm.slug}
                    onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                    placeholder="cocina"
                  />
                </label>
              </div>
              <label className="shop-field">
                <span className="shop-field__label">Descripción</span>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows={2}
                  placeholder="Breve descripción para el equipo interno"
                />
              </label>
              <div className="shop-field-row">
                <label className="shop-field">
                  <span className="shop-field__label">Icono</span>
                  <span className="shop-field__hint">Opcional · ej. utensils, spray-can</span>
                  <input
                    value={categoryForm.icon}
                    onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
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
              </div>
              <div className="shop-form__bar">
                <button type="submit" className="admin-btn">
                  {editingCategoryId ? 'Guardar categoría' : 'Crear categoría'}
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
            <div className="shop-table-card__head">
              <h2>Categorías activas</h2>
              <p>{activeCategories.length} categoría(s) visibles en el catálogo.</p>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Categoría</th>
                  <th>Slug</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {activeCategories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="admin-empty">
                      No hay categorías.
                    </td>
                  </tr>
                ) : (
                  activeCategories.map((category) => (
                    <tr key={category._id}>
                      <td>{category.sortOrder ?? 0}</td>
                      <td>
                        <strong>{category.name}</strong>
                        {category.description && (
                          <span className="admin-empty" style={{ display: 'block' }}>
                            {category.description}
                          </span>
                        )}
                      </td>
                      <td>{category.slug}</td>
                      <td className="admin-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          onClick={() => startEditCategory(category)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--danger"
                          onClick={() => deactivateCategory(category._id)}
                        >
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

      {section === 'products' && (
        <>
          <div className="shop-editor">
            <div className="shop-editor__head">
              <h2>{editingProductId ? 'Editar producto' : 'Nuevo producto'}</h2>
              <p>
                Publica artículos de hogar para residentes. Elige el país, define precio, stock e
                imágenes del catálogo.
              </p>
            </div>

            <form className="shop-form" onSubmit={handleProductSubmit}>
              <div className="shop-form__country-bar">
                <label className="shop-field shop-field--country">
                  <span className="shop-field__label">País del producto</span>
                  <span className="shop-field__hint">
                    Define moneda y visibilidad en el shop de residentes
                  </span>
                  <select
                    value={productForm.country}
                    onChange={(e) => setProductForm({ ...productForm, country: e.target.value })}
                  >
                    {SHOP_COUNTRIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label} · {item.currency}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="shop-form__grid">
                <div className="shop-form__primary">
                  <section className="shop-panel">
                    <h3 className="shop-panel__title">Información general</h3>
                    <p className="shop-panel__hint">Lo que verá el residente en la ficha del producto.</p>
                    <div className="shop-field-row">
                      <label className="shop-field">
                        <span className="shop-field__label">Nombre del producto</span>
                        <input
                          value={productForm.name}
                          onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                          placeholder="Ej: Set ollas antiadherentes"
                          required
                        />
                      </label>
                      <label className="shop-field">
                        <span className="shop-field__label">Categoría</span>
                        <select
                          value={productForm.categoryId}
                          onChange={(e) =>
                            setProductForm({ ...productForm, categoryId: e.target.value })
                          }
                          required
                        >
                          <option value="">Seleccionar categoría</option>
                          {activeCategories.map((category) => (
                            <option key={category._id} value={category._id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="shop-field">
                      <span className="shop-field__label">Descripción corta</span>
                      <span className="shop-field__hint">Aparece en la tarjeta del catálogo</span>
                      <input
                        value={productForm.shortDescription}
                        onChange={(e) =>
                          setProductForm({ ...productForm, shortDescription: e.target.value })
                        }
                        placeholder="Resumen en una línea"
                      />
                    </label>
                    <label className="shop-field">
                      <span className="shop-field__label">Descripción completa</span>
                      <textarea
                        value={productForm.description}
                        onChange={(e) =>
                          setProductForm({ ...productForm, description: e.target.value })
                        }
                        rows={5}
                        placeholder="Detalle del producto, materiales, uso recomendado…"
                      />
                    </label>
                  </section>
                </div>

                <aside className="shop-form__sidebar">
                  <section className="shop-panel">
                    <h3 className="shop-panel__title">Comercial</h3>
                    <p className="shop-panel__hint">Precio, inventario y posición en el catálogo.</p>
                    <div className="shop-field-row shop-field-row--compact">
                      <label className="shop-field">
                        <span className="shop-field__label">Precio ({productCurrency})</span>
                        <input
                          type="number"
                          min="0"
                          value={productForm.price}
                          onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                          required
                        />
                      </label>
                      <label className="shop-field">
                        <span className="shop-field__label">Precio anterior ({productCurrency})</span>
                        <input
                          type="number"
                          min="0"
                          value={productForm.compareAtPrice}
                          onChange={(e) =>
                            setProductForm({ ...productForm, compareAtPrice: e.target.value })
                          }
                          placeholder="Opcional"
                        />
                      </label>
                    </div>
                    <div className="shop-field-row shop-field-row--compact">
                      <label className="shop-field">
                        <span className="shop-field__label">SKU</span>
                        <input
                          value={productForm.sku}
                          onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                          placeholder="COC-001"
                        />
                      </label>
                      <label className="shop-field">
                        <span className="shop-field__label">Stock</span>
                        <input
                          type="number"
                          min="0"
                          value={productForm.stock}
                          onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                          placeholder="Ilimitado"
                        />
                      </label>
                    </div>
                    <label className="shop-field">
                      <span className="shop-field__label">Orden en catálogo</span>
                      <input
                        type="number"
                        value={productForm.sortOrder}
                        onChange={(e) => setProductForm({ ...productForm, sortOrder: e.target.value })}
                      />
                    </label>
                    <label className="shop-check">
                      <input
                        type="checkbox"
                        checked={productForm.isFeatured}
                        onChange={(e) =>
                          setProductForm({ ...productForm, isFeatured: e.target.checked })
                        }
                      />
                      <span>Destacar en el shop</span>
                    </label>
                  </section>

                  <section className="shop-panel">
                    <h3 className="shop-panel__title">Imágenes</h3>
                    <p className="shop-panel__hint">La primera imagen será la portada del producto.</p>
                    {productImages.length > 0 && (
                      <div className="shop-gallery">
                        {productImages.map((img, index) => (
                          <div key={`${img.url}-${index}`} className="shop-gallery__item">
                            <img src={img.url} alt="" />
                            <button
                              type="button"
                              className="shop-gallery__remove"
                              onClick={() => removeImage(index)}
                              aria-label="Quitar imagen"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="shop-upload">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                      />
                      <p className="shop-upload__title">
                        {uploading ? 'Subiendo imagen…' : 'Subir imagen'}
                      </p>
                      <p className="shop-upload__meta">JPG o PNG · máx. 5 MB</p>
                    </label>
                    <label className="shop-field">
                      <span className="shop-field__label">URL externa</span>
                      <span className="shop-field__hint">Se agrega al guardar, si la indicas</span>
                      <input
                        value={productForm.imageUrl}
                        onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                        placeholder="https://…"
                      />
                    </label>
                  </section>
                </aside>
              </div>

              <div className="shop-form__bar">
                <button type="submit" className="admin-btn">
                  {editingProductId ? 'Guardar cambios' : 'Publicar producto'}
                </button>
                {editingProductId && (
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={resetProductForm}>
                    Cancelar edición
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="admin-card admin-table-wrap shop-table-card">
            <div className="shop-table-card__head">
              <h2>Catálogo publicado</h2>
              <p>{activeProducts.length} producto(s) activos en el shop de residentes.</p>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>País</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {activeProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin-empty">
                      No hay productos publicados.
                    </td>
                  </tr>
                ) : (
                  activeProducts.map((product) => (
                    <tr key={product._id}>
                      <td>
                        <div className="shop-product-cell">
                          {product.images?.[0]?.url && (
                            <img
                              src={product.images[0].url}
                              alt=""
                              className="shop-product-cell__thumb"
                            />
                          )}
                          <div>
                            <span className="shop-product-cell__name">
                              {product.name}
                              {product.isFeatured && (
                                <span className="admin-badge admin-badge--paid" style={{ marginLeft: 6 }}>
                                  Destacado
                                </span>
                              )}
                            </span>
                            {product.shortDescription && (
                              <span className="shop-product-cell__meta">{product.shortDescription}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{product.categoryId?.name || '—'}</td>
                      <td>
                        {formatMoney(product.price, product.currency || 'COP')}
                        {product.compareAtPrice > product.price && (
                          <span className="admin-empty" style={{ display: 'block', textDecoration: 'line-through' }}>
                            {formatMoney(product.compareAtPrice, product.currency || 'COP')}
                          </span>
                        )}
                      </td>
                      <td>{resolveProductCountry(product)}</td>
                      <td>
                        <span className="admin-badge admin-badge--paid">Activo</span>
                      </td>
                      <td className="admin-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          onClick={() => startEditProduct(product)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--danger"
                          onClick={() => deactivateProduct(product._id)}
                        >
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
