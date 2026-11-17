import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from './supabase/server';
import baseProductsJson from '@/data/productos_base.json';
import { Product, getProductCatalogAssignments, invalidateProductCaches } from './ventify';
import { getProductActiveSlugs } from './catalogos';

const CUSTOM_PRODUCTS_PATH = path.join(process.cwd(), 'src/data/productos_custom.json');

function getCustomProductsFromFile(): Product[] {
  try {
    if (fs.existsSync(CUSTOM_PRODUCTS_PATH)) {
      const content = fs.readFileSync(CUSTOM_PRODUCTS_PATH, 'utf8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error('Error leyendo productos_custom.json:', e);
  }
  return [];
}

function saveCustomProductsToFile(products: Product[]) {
  try {
    const dir = path.dirname(CUSTOM_PRODUCTS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CUSTOM_PRODUCTS_PATH, JSON.stringify(products, null, 2), 'utf8');
  } catch (e) {
    console.error('Error guardando productos_custom.json:', e);
  }
}

/**
 * Obtiene todos los productos combinando la tabla public.productos de Supabase
 * con el catálogo base (49 productos preservados) y productos personalizados.
 */
export async function getAllLocalProducts(): Promise<Product[]> {
  const customProducts = getCustomProductsFromFile();

  // Intentar consultar Supabase public.productos
  try {
    const { data: dbProducts, error } = await supabaseAdmin
      .from('productos')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(dbProducts)) {
      if (dbProducts.length === 0) {
        // Auto-seed: la tabla existe pero está vacía, migrar los 49 productos base a Supabase
        await seedProductsToSupabase(baseProductsJson as unknown as Array<Record<string, unknown>>);
      } else {
        const assignments = await getProductCatalogAssignments();
        return dbProducts.map((p) => {
          const prod: Product = {
            id: p.id,
            sku: p.sku || '',
            nombre: p.nombre,
            precio: Number(p.precio) || 0,
            imagen: p.imagen || '',
            imagenes: Array.isArray(p.imagenes) ? p.imagenes : [],
            categoria: (p.categoria as Product['categoria']) || 'General',
            categoriaOriginal: p.categoria_original || null,
            stock: Number(p.stock) || 0,
            descripcion: p.descripcion || '',
            catalogos: Array.isArray(p.catalogos) && p.catalogos.length > 0 ? p.catalogos : [],
            is_active: p.is_active !== false,
          };
          prod.catalogos = getProductActiveSlugs(prod, assignments);
          return prod;
        });
      }
    }
  } catch (e) {
    console.warn('public.productos en Supabase aún no disponible, usando snapshot local:', e);
  }

  // Fallback: los 49 productos base + custom products locales
  const combined = [...customProducts, ...(baseProductsJson as Product[])];
  const seenIds = new Set<string>();
  const uniqueProducts: Product[] = [];

  for (const p of combined) {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      uniqueProducts.push(p);
    }
  }

  // Enriquecer con asignaciones actuales de Supabase
  try {
    const assignments = await getProductCatalogAssignments();
    uniqueProducts.forEach((p) => {
      p.catalogos = getProductActiveSlugs(p, assignments);
    });
  } catch (e) {
    console.error('Error enriqueciendo catálogos:', e);
  }

  return uniqueProducts;
}

/**
 * Inserta los 49 productos base en Supabase public.productos cuando la tabla esté disponible
 */
async function seedProductsToSupabase(baseProducts: Array<Record<string, unknown>>) {
  try {
    const rows = baseProducts.map((p) => ({
      id: p.id as string,
      sku: p.sku || '',
      nombre: p.nombre,
      precio: Number(p.precio) || 0,
      imagen: p.imagen || '',
      categoria: p.categoria || 'General',
      categoria_original: p.categoriaOriginal || null,
      stock: Number(p.stock) || 0,
      descripcion: p.descripcion || '',
      catalogos: Array.isArray(p.catalogos) ? p.catalogos : [],
      is_active: true,
    }));
    await supabaseAdmin.from('productos').upsert(rows, { onConflict: 'id' });
    console.log('Se migraron exitosamente los', rows.length, 'productos base a Supabase');
  } catch (e) {
    console.error('Error al hacer seed de productos en Supabase:', e);
  }
}

/**
 * Guarda o actualiza un producto en el sistema (Supabase + fallback local)
 */
export async function saveProduct(productData: {
  id?: string;
  sku?: string;
  nombre: string;
  precio: number;
  imagen: string;
  imagenes?: string[];
  categoria: 'Ramos' | 'Amigurumis' | 'Cajas' | 'Personalizado' | 'General' | string;
  stock?: number;
  descripcion?: string;
  catalogos?: string[];
  is_active?: boolean;
}): Promise<Product> {
  const id = productData.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sku = productData.sku || `${String(productData.categoria || '').substring(0, 4).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  const imagenes = Array.isArray(productData.imagenes) ? productData.imagenes.filter(Boolean) : [];
  const primaryImg = productData.imagen?.trim() || imagenes[0] || '';

  const newProduct: Product = {
    id,
    sku,
    nombre: productData.nombre.trim(),
    precio: Number(productData.precio) || 0,
    imagen: primaryImg,
    imagenes: imagenes.length > 0 ? imagenes : (primaryImg ? [primaryImg] : []),
    categoria: productData.categoria,
    stock: Number(productData.stock) || 0,
    descripcion: (productData.descripcion || '').trim(),
    catalogos: Array.isArray(productData.catalogos) ? productData.catalogos : [],
    is_active: productData.is_active !== false,
  };

  // 1. Guardar en Supabase public.productos si existe
  try {
    await supabaseAdmin.from('productos').upsert({
      id: newProduct.id,
      sku: newProduct.sku,
      nombre: newProduct.nombre,
      precio: newProduct.precio,
      imagen: newProduct.imagen,
      imagenes: newProduct.imagenes,
      categoria: newProduct.categoria,
      stock: newProduct.stock,
      descripcion: newProduct.descripcion,
      catalogos: newProduct.catalogos,
      is_active: newProduct.is_active,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('No se pudo guardar en Supabase public.productos:', e);
  }

  // 2. Guardar asignaciones en producto_catalogos para que funcionen todos los filtros
  if (Array.isArray(newProduct.catalogos) && newProduct.catalogos.length > 0) {
    try {
      const assignmentsToInsert = newProduct.catalogos.map((catSlug) => ({
        producto_id: newProduct.id,
        sku: newProduct.sku,
        categoria_slug: catSlug.toLowerCase().trim(),
        incluir: true,
      }));
      await supabaseAdmin
        .from('producto_catalogos')
        .upsert(assignmentsToInsert, { onConflict: 'producto_id,categoria_slug' });
    } catch (e) {
      console.warn('Error guardando producto_catalogos:', e);
    }
  }

  // 3. Guardar en fallback local productos_custom.json
  const currentCustom = getCustomProductsFromFile();
  const existingIdx = currentCustom.findIndex((p) => p.id === newProduct.id);
  if (existingIdx >= 0) {
    currentCustom[existingIdx] = newProduct;
  } else {
    currentCustom.unshift(newProduct);
  }
  saveCustomProductsToFile(currentCustom);

  // Invalida cachés
  invalidateProductCaches();

  return newProduct;
}

/**
 * Elimina uno o varios productos del sistema (Supabase + fallback local)
 */
export async function deleteProductsByIds(productIds: string[]): Promise<{ deletedCount: number }> {
  const cleanIds = Array.from(new Set(productIds.map((id) => String(id).trim()).filter(Boolean)));
  if (cleanIds.length === 0) {
    return { deletedCount: 0 };
  }

  // 1. Eliminar de Supabase public.productos
  const { error: prodError } = await supabaseAdmin
    .from('productos')
    .delete()
    .in('id', cleanIds);

  if (prodError) {
    console.warn('Error eliminando en Supabase public.productos:', prodError.message);
  }

  // 2. Limpiar asignaciones en producto_catalogos y productos_inactivos
  try {
    await supabaseAdmin
      .from('producto_catalogos')
      .delete()
      .in('producto_id', cleanIds);
  } catch (e) {
    console.warn('Error limpiando producto_catalogos:', e);
  }

  try {
    await supabaseAdmin
      .from('productos_inactivos')
      .delete()
      .in('producto_id', cleanIds);
  } catch (e) {
    console.warn('Error limpiando productos_inactivos:', e);
  }

  // 3. Eliminar de fallback local productos_custom.json si existe ahí
  const idSet = new Set(cleanIds);
  const currentCustom = getCustomProductsFromFile();
  const filteredCustom = currentCustom.filter((p) => !idSet.has(p.id));
  if (filteredCustom.length !== currentCustom.length) {
    saveCustomProductsToFile(filteredCustom);
  }

  // 4. Invalidar cachés en memoria
  invalidateProductCaches();

  return { deletedCount: cleanIds.length };
}
