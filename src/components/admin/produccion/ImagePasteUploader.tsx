"use client";

import React, { useState, useRef, useEffect } from "react";
import { Camera, Image as ImageIcon, Upload, X, Loader2, Sparkles } from "lucide-react";

interface ImagePasteUploaderProps {
  imagenUrl?: string;
  onImageChange: (url: string) => void;
  label?: string;
}

export default function ImagePasteUploader({
  imagenUrl,
  onImageChange,
  label = "Foto del Producto / Modelo",
}: ImagePasteUploaderProps) {
  const [cargando, setCargando] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Comprimir imagen usando canvas para respuesta ultra-rápida y menor peso
  const procesarArchivoImagen = async (file: File) => {
    setCargando(true);
    try {
      // 1. Convertir a Data URL optimizada
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawUrl = e.target?.result as string;
        if (!rawUrl) {
          setCargando(false);
          return;
        }

        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedDataUrl = canvas.toDataURL("image/webp", 0.85);

            // Intentar subir a Supabase Storage si está disponible
            try {
              const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
              const supabase = getSupabaseBrowserClient();
              const ext = "webp";
              const fileName = `produccion-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

              // Convertir dataUrl a Blob
              const byteString = atob(optimizedDataUrl.split(",")[1]);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              const blob = new Blob([ab], { type: "image/webp" });

              const { data: uploadData, error } = await supabase.storage
                .from("heroes")
                .upload(fileName, blob, { upsert: true, contentType: "image/webp" });

              if (!error && uploadData) {
                const { data: pub } = supabase.storage.from("heroes").getPublicUrl(fileName);
                if (pub?.publicUrl) {
                  onImageChange(pub.publicUrl);
                  setCargando(false);
                  return;
                }
              }
            } catch (storageErr) {
              // Si falla supabase storage, usamos optimizedDataUrl directamente
            }

            onImageChange(optimizedDataUrl);
          } else {
            onImageChange(rawUrl);
          }
          setCargando(false);
        };
        img.src = rawUrl;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error al procesar imagen:", err);
      setCargando(false);
    }
  };

  // Escuchar evento de pegar (Ctrl + V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            procesarArchivoImagen(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        procesarArchivoImagen(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      procesarArchivoImagen(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-1.5 font-quicksand">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
          <Camera size={14} className="text-[#EE6B8D]" />
          <span>{label}</span>
        </label>
        <span className="text-[11px] text-[#C04267] font-semibold bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
          Pega con Ctrl+V o toca para subir
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {imagenUrl ? (
        <div className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden border-2 border-pink-200 group bg-gray-50 shadow-xs">
          <img
            src={imagenUrl}
            alt="Vista previa"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-white text-gray-800 text-xs font-bold shadow-md hover:bg-pink-50 transition-all flex items-center gap-1.5"
            >
              <Upload size={14} />
              <span>Cambiar</span>
            </button>
            <button
              type="button"
              onClick={() => onImageChange("")}
              className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md hover:bg-red-700 transition-all flex items-center gap-1.5"
            >
              <X size={14} />
              <span>Quitar</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onImageChange("")}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors sm:hidden"
            title="Quitar foto"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full py-6 px-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2 ${
            isDragOver
              ? "border-[#EE6B8D] bg-pink-50/70 scale-101"
              : "border-pink-200 bg-[#FDF4F7]/60 hover:bg-[#FDF4F7] hover:border-[#EE6B8D]"
          }`}
        >
          {cargando ? (
            <div className="flex flex-col items-center gap-2 text-[#EE6B8D] py-3">
              <Loader2 size={28} className="animate-spin" />
              <span className="text-xs font-bold">Procesando y optimizando imagen...</span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-white text-[#EE6B8D] flex items-center justify-center shadow-xs border border-pink-100">
                <Camera size={22} />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-gray-800">
                  Toca para elegir foto o tomar con tu tablet/celular
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  También puedes presionar <strong>Ctrl + V</strong> para pegar directamente desde tu portapapeles
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
