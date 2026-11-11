/**
 * Utilidades de imágenes para pedidos (referencias y fotos de entrega).
 * Solo debe usarse en el cliente (usa canvas y el cliente de Supabase del navegador).
 */

function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("No se pudo leer la imagen"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}

/**
 * Comprime una imagen a WebP con un ancho/alto máximo y devuelve la data URL.
 */
export async function comprimirImagen(
  file: File,
  maxSize = 1200,
  calidad = 0.85
): Promise<string> {
  const rawUrl = await leerComoDataUrl(file);
  const img = await cargarImagen(rawUrl);

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (!width || !height) return rawUrl;

  if (width > height) {
    if (width > maxSize) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    }
  } else if (height > maxSize) {
    width = Math.round((width * maxSize) / height);
    height = maxSize;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return rawUrl;

  // Fondo blanco para imágenes con transparencia (PNG)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  try {
    return canvas.toDataURL("image/webp", calidad);
  } catch {
    return canvas.toDataURL("image/jpeg", calidad);
  }
}

/**
 * Sube la imagen a Supabase Storage (bucket "pedidos" o "heroes") y devuelve la URL pública.
 * Si no hay acceso al storage, devuelve la data URL comprimida para no perder la foto.
 */
export async function subirFoto(file: File, maxSize = 1200): Promise<string> {
  const dataUrl = await comprimirImagen(file, maxSize);

  try {
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
    const supabase = getSupabaseBrowserClient();

    // dataUrl -> Blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    const fileName = `pedido-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}.webp`;

    for (const bucket of ["pedidos", "heroes"]) {
      try {
        const { error } = await supabase.storage
          .from(bucket)
          .upload(fileName, blob, { upsert: true, contentType: "image/webp" });

        if (!error) {
          const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
          if (data?.publicUrl) return data.publicUrl;
        }
      } catch {
        // Probar el siguiente bucket
      }
    }
  } catch {
    // Sin storage disponible: usamos la data URL comprimida
  }

  return dataUrl;
}
