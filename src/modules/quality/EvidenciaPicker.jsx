import { useState } from "react";
import { fileToResizedBlob, CameraCaptureModal } from "./imagenUtils";

// Elegir fotos ANTES de guardar el formulario (aún no existe el id de la
// inspección para subirlas a Storage) — se guardan como blobs locales con
// vista previa, y el formulario las sube una por una después de crear el
// registro (ver handleGuardar en MateriaPrimaPanel.jsx).
export default function EvidenciaPicker({ fotos, onChange }) {
  const [showCamera, setShowCamera] = useState(false);

  function agregar(blob) {
    onChange([...fotos, { blob, previewUrl: URL.createObjectURL(blob) }]);
  }

  function quitar(index) {
    const foto = fotos[index];
    if (foto?.previewUrl) URL.revokeObjectURL(foto.previewUrl);
    onChange(fotos.filter((_, i) => i !== index));
  }

  async function handleFileInput(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    agregar(await fileToResizedBlob(file));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-xl border border-[#edf0f4] bg-white px-3 py-1.5 text-xs font-medium text-[#0f1f3d] shadow-[0_1px_2px_rgba(11,31,58,0.08)] transition hover:border-[#f0d885] active:scale-[0.98]">
          📎 Subir foto
          <input type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
        </label>
        <button
          type="button"
          onClick={() => setShowCamera(true)}
          className="rounded-xl border border-[#edf0f4] bg-white px-3 py-1.5 text-xs font-medium text-[#0f1f3d] shadow-[0_1px_2px_rgba(11,31,58,0.08)] transition hover:border-[#f0d885] active:scale-[0.98]"
        >
          📷 Tomar foto
        </button>
      </div>
      {fotos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {fotos.map((foto, i) => (
            <div key={foto.previewUrl} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
              <img src={foto.previewUrl} alt="Evidencia" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => quitar(i)}
                className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl bg-red-600/90 text-[9px] font-black text-white opacity-0 transition group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {showCamera && (
        <CameraCaptureModal
          onCapture={(blob) => { setShowCamera(false); agregar(blob); }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
