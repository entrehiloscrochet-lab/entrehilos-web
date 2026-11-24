"use client";

import type { FormEvent } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  UserCircle,
} from "lucide-react";

interface ProfileTabProps {
  userEmail: string;
  formNombre: string;
  formTelefono: string;
  formDepartamento: string;
  formProvincia: string;
  formDistrito: string;
  formDireccion: string;
  formReferencia: string;
  departamentos: string[];
  provincias: string[];
  distritos: string[];
  isDirty: boolean;
  guardando: boolean;
  guardadoExito: boolean;
  onChangeNombre: (v: string) => void;
  onChangeTelefono: (v: string) => void;
  onChangeDepartamento: (v: string) => void;
  onChangeProvincia: (v: string) => void;
  onChangeDistrito: (v: string) => void;
  onChangeDireccion: (v: string) => void;
  onChangeReferencia: (v: string) => void;
  onReset: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

const inputBaseClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-[#E8D8DE] bg-white font-quicksand text-sm text-gray-800 placeholder:text-gray-400 outline-none transition-all focus:border-[#EE6B8D] focus:ring-3 focus:ring-[#EE6B8D]/15";

const selectBaseClass =
  "w-full appearance-none px-3.5 py-2.5 pr-9 rounded-xl border border-[#E8D8DE] bg-white font-quicksand text-sm text-gray-800 outline-none transition-all focus:border-[#EE6B8D] focus:ring-3 focus:ring-[#EE6B8D]/15 disabled:bg-[#FAF6F8] disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer";

export function ProfileTab({
  userEmail,
  formNombre,
  formTelefono,
  formDepartamento,
  formProvincia,
  formDistrito,
  formDireccion,
  formReferencia,
  departamentos,
  provincias,
  distritos,
  isDirty,
  guardando,
  guardadoExito,
  onChangeNombre,
  onChangeTelefono,
  onChangeDepartamento,
  onChangeProvincia,
  onChangeDistrito,
  onChangeDireccion,
  onChangeReferencia,
  onReset,
  onSubmit,
}: ProfileTabProps) {
  const localidadResumen = [
    formDireccion.trim(),
    formDistrito,
    formProvincia,
    formDepartamento,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Tarjeta 1: Datos personales */}
      <section className="bg-white rounded-2xl border border-[#F0E2E7] p-4 sm:p-6 shadow-[0_2px_12px_rgba(192,66,103,0.03)] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-[#F4E9ED]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FDF2F5] text-[#C04267] flex items-center justify-center shrink-0">
              <UserCircle size={19} />
            </div>
            <div className="min-w-0">
              <h3 className="font-fredoka text-base sm:text-lg font-bold text-gray-800 leading-tight">
                Datos personales
              </h3>
              <p className="font-quicksand text-xs text-gray-500 mt-0.5">
                Información de contacto asociada a tu cuenta.
              </p>
            </div>
          </div>

          {isDirty && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-quicksand text-[11px] font-semibold">
              <AlertCircle size={12} />
              Cambios sin guardar
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {/* Nombre completo */}
          <div>
            <label
              htmlFor="perfil-nombre"
              className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5"
            >
              Nombre completo
            </label>
            <input
              id="perfil-nombre"
              type="text"
              autoComplete="name"
              value={formNombre}
              onChange={(e) => onChangeNombre(e.target.value)}
              placeholder="Ej: María Pérez"
              className={inputBaseClass}
            />
          </div>

          {/* Teléfono / WhatsApp */}
          <div>
            <label
              htmlFor="perfil-telefono"
              className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5"
            >
              Teléfono / WhatsApp
            </label>
            <div className="flex items-center rounded-xl border border-[#E8D8DE] bg-white overflow-hidden focus-within:border-[#EE6B8D] focus-within:ring-3 focus-within:ring-[#EE6B8D]/15 transition-all">
              <span className="inline-flex items-center gap-1 px-3 py-2.5 bg-[#FAF6F8] border-r border-[#E8D8DE] font-quicksand text-xs font-bold text-[#C04267] shrink-0">
                <Phone size={12} />
                +51
              </span>
              <input
                id="perfil-telefono"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={formTelefono}
                onChange={(e) => onChangeTelefono(e.target.value)}
                placeholder="999 888 777"
                className="w-full px-3 py-2.5 font-quicksand text-sm text-gray-800 placeholder:text-gray-400 outline-none bg-transparent"
              />
            </div>
            <p className="font-quicksand text-[11px] text-gray-500 mt-1.5 leading-relaxed">
              Lo usamos para coordinar tus entregas y sincronizar automáticamente pedidos hechos por WhatsApp.
            </p>
          </div>

          {/* Correo electrónico (badge encima para evitar solapamiento en móvil) */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor="perfil-email"
                className="block font-quicksand text-xs font-semibold text-gray-700"
              >
                Correo electrónico
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] font-quicksand font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shrink-0">
                <Check size={11} />
                Verificado
              </span>
            </div>
            <div className="relative flex items-center rounded-xl border border-[#EADCE1] bg-[#FAF6F8] px-3.5 py-2.5 text-gray-600">
              <Mail size={15} className="text-gray-400 shrink-0 mr-2.5" />
              <input
                id="perfil-email"
                type="email"
                value={userEmail}
                readOnly
                aria-readonly="true"
                className="w-full bg-transparent font-quicksand text-sm text-gray-600 outline-none cursor-not-allowed truncate"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Tarjeta 2: Dirección y localidad habitual */}
      <section className="bg-white rounded-2xl border border-[#F0E2E7] p-4 sm:p-6 shadow-[0_2px_12px_rgba(192,66,103,0.03)] space-y-5">
        <div className="flex items-center gap-3 pb-3.5 border-b border-[#F4E9ED]">
          <div className="w-9 h-9 rounded-xl bg-[#FDF2F5] text-[#C04267] flex items-center justify-center shrink-0">
            <MapPin size={19} />
          </div>
          <div className="min-w-0">
            <h3 className="font-fredoka text-base sm:text-lg font-bold text-gray-800 leading-tight">
              Dirección habitual de entrega
            </h3>
            <p className="font-quicksand text-xs text-gray-500 mt-0.5">
              Se sugerirá automáticamente cuando realices tu siguiente compra.
            </p>
          </div>
        </div>

        {localidadResumen && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FCF7F9] border border-[#F3DCE4]">
            <MapPin size={15} className="text-[#C04267] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-quicksand text-[11px] font-bold uppercase tracking-wider text-[#C04267] block">
                Destino configurado
              </span>
              <p className="font-quicksand text-xs sm:text-sm font-medium text-gray-700 break-words">
                {localidadResumen}
                {formReferencia.trim() ? ` · Ref: ${formReferencia.trim()}` : ""}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Departamento */}
          <div>
            <label
              htmlFor="perfil-departamento"
              className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5"
            >
              Departamento
            </label>
            <div className="relative">
              <select
                id="perfil-departamento"
                value={formDepartamento}
                onChange={(e) => {
                  onChangeDepartamento(e.target.value);
                  onChangeProvincia("");
                  onChangeDistrito("");
                }}
                className={selectBaseClass}
              >
                <option value="">Seleccionar departamento</option>
                {departamentos.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Provincia */}
          <div>
            <label
              htmlFor="perfil-provincia"
              className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5"
            >
              Provincia
            </label>
            <div className="relative">
              <select
                id="perfil-provincia"
                value={formProvincia}
                onChange={(e) => {
                  onChangeProvincia(e.target.value);
                  onChangeDistrito("");
                }}
                disabled={!formDepartamento}
                className={selectBaseClass}
              >
                <option value="">Seleccionar provincia</option>
                {provincias.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Distrito */}
          <div>
            <label
              htmlFor="perfil-distrito"
              className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5"
            >
              Distrito / Localidad
            </label>
            <div className="relative">
              <select
                id="perfil-distrito"
                value={formDistrito}
                onChange={(e) => onChangeDistrito(e.target.value)}
                disabled={!formProvincia}
                className={selectBaseClass}
              >
                <option value="">Seleccionar distrito</option>
                {distritos.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="perfil-direccion"
              className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5"
            >
              Dirección exacta (calle, avenida, número)
            </label>
            <input
              id="perfil-direccion"
              type="text"
              autoComplete="street-address"
              value={formDireccion}
              onChange={(e) => onChangeDireccion(e.target.value)}
              placeholder="Ej: Av. Las Flores 123, Dpto 402"
              className={inputBaseClass}
            />
          </div>

          <div>
            <label
              htmlFor="perfil-referencia"
              className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5"
            >
              Referencia de llegada (opcional)
            </label>
            <input
              id="perfil-referencia"
              type="text"
              value={formReferencia}
              onChange={(e) => onChangeReferencia(e.target.value)}
              placeholder="Ej: Frente al parque, rejas blancas"
              className={inputBaseClass}
            />
          </div>
        </div>

        {/* Barra de acción */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[#F4E9ED]">
          <div className="min-h-[20px]">
            {guardadoExito ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-quicksand text-xs font-semibold">
                <Check size={13} />
                Datos actualizados con éxito
              </span>
            ) : isDirty ? (
              <p className="font-quicksand text-xs text-amber-700 font-medium">
                Recuerda guardar tus cambios antes de salir.
              </p>
            ) : (
              <p className="font-quicksand text-xs text-gray-400">
                Tus datos se completan automáticamente al finalizar una compra.
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5">
            {isDirty && (
              <button
                type="button"
                onClick={onReset}
                disabled={guardando}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full font-quicksand text-xs sm:text-sm font-semibold text-gray-600 bg-[#FAF6F8] hover:bg-[#F3EAEE] border border-[#E8D8DE] transition-colors cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]"
              >
                <RotateCcw size={14} />
                Descartar
              </button>
            )}
            <button
              type="submit"
              disabled={guardando}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 sm:py-3 rounded-full font-quicksand text-sm font-semibold text-white bg-[#C04267] hover:bg-[#A63558] transition-all disabled:opacity-50 cursor-pointer shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D] focus-visible:ring-offset-2"
            >
              {guardando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Guardar datos
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
