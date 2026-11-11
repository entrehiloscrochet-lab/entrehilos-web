"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ClipboardPaste, ImagePlus, Loader2, X } from "lucide-react";
import { subirFoto } from "@/lib/upload-foto";

interface OrderPhotoUploaderProps {
  fotos: string[];
  onChange: (fotos: string[]) => void;
  max?: number;
  label?: string;
  hint?: string;
  compact?: boolean;
}

export default function OrderPhotoUploader({
  fotos,
  onChange,
  max = 8,
  label = "Fotos",
  hint,
  compact = false,
}: OrderPhotoUploaderProps) {
  const [subiendo, setSubiendo] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ref para evitar closures obsoletos en el listener global de pegado
  const fotosRef = useRef(fotos);
  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const imagenes = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (imagenes.length === 0) return;

      const espacio = max - fotosRef.current.length;
      if (espacio <= 0) {
        setError(`Máximo ${max} foto(s) permitida(s).`);
        return;
      }

      setSubiendo(true);
      setError(null);
      try {
        const nuevas: string[] = [];
        for (const file of imagenes.slice(0, espacio)) {
          try {
            nuevas.push(await subirFoto(file));
          } catch (err) {
            console.error("Error al subir foto:", err);
          }
        }
        if (nuevas.length > 0) {
          onChange([...fotosRef.current, ...nuevas]);
        } else {
          setError("No se pudo procesar la imagen. Intenta con otra.");
        }
      } finally {
        setSubiendo(false);
      }
    },
    [max, onChange]
  );

  // Pegar desde el portapapeles con Ctrl + V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const archivos: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) archivos.push(file);
        }
      }
      if (archivos.length > 0) {
        e.preventDefault();
        handleFiles(archivos);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFiles]);

  const pegarDesdeBoton = async () => {
    setError(null);
    try {
      const puedeLeer = typeof navigator !== "undefined" && !!navigator.clipboard?.read;
      if (!puedeLeer) {
        setError("Tu navegador no permite leer el portapapeles. Usa Ctrl + V.");
        return;
      }
      const items = await navigator.clipboard.read();
      const archivos: File[] = [];
      for (const item of items) {
        const tipo = item.types.find((t) => t.startsWith("image/"));
        if (tipo) {
          const blob = await item.getType(tipo);
          archivos.push(
            new File([blob], `pegado-${Date.now()}.png`, { type: blob.type || "image/png" })
          );
        }
      }
      if (archivos.length === 0) {
        setError("No hay ninguna imagen en el portapapeles.");
        return;
      }
      await handleFiles(archivos);
    } catch {
      setError("No se pudo leer el portapapeles. Usa Ctrl + V.");
    }
  };

  const quitar = (url: string) => {
    onChange(fotosRef.current.filter((f) => f !== url));
  };

  return (
    <div className="space-y-2">
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
            <Camera size={13} className="text-[#EE6B8D]" />
            <span>{label}</span>
          </label>
          <span className="text-[10px] text-[#C04267] font-semibold bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
            Ctrl + V para pegar
          </span>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={max > 1}
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
        className="hidden"
      />

      {/* Miniaturas */}
      {fotos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fotos.map((url) => (
            <div
              key={url}
              className={`relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group ${
                compact ? "w-16 h-16" : "w-20 h-20"
              }`}
            >
              <img src={url} alt="Foto del pedido" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => quitar(url)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                title="Quitar foto"
              >
                <X size={11} />
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0"
                title="Ver foto completa"
              />
            </div>
          ))}
        </div>
      )}

      {/* Zona para adjuntar */}
      {fotos.length < max && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
          }}
          className={`rounded-xl border-2 border-dashed transition-colors flex items-center justify-between gap-2 px-3 ${
            compact ? "py-2" : "py-3"
          } ${dragOver ? "border-[#EE6B8D] bg-pink-50/70" : "border-pink-200 bg-[#FDF4F7]/50"}`}
        >
          {subiendo ? (
            <div className="flex items-center gap-2 text-[#EE6B8D] text-xs font-bold py-1">
              <Loader2 size={16} className="animate-spin" />
              <span>Subiendo foto...</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-bold text-[#C04267] hover:text-[#EE6B8D] py-1"
              >
                <ImagePlus size={15} />
                <span>Adjuntar foto</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={pegarDesdeBoton}
                  className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-[#C04267] py-1 px-1.5 rounded-md hover:bg-white transition-colors"
                  title="Pegar desde el portapapeles"
                >
                  <ClipboardPaste size={13} />
                  <span>Pegar</span>
                </button>
                <span className="text-[10px] text-gray-400 hidden sm:inline">
                  o arrastra aquí
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {hint ? <p className="text-[10px] text-gray-400 leading-tight">{hint}</p> : null}
      {error ? <p className="text-[10px] text-rose-600 font-semibold">{error}</p> : null}
    </div>
  );
}
