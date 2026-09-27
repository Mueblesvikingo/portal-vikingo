import { useState } from "react";
import { subirEvidencia, eliminarEvidencia } from "../../services/calidadService";
import { fileToResizedBlob, CameraCaptureModal } from "./imagenUtils";

// Evidencia de un registro YA GUARDADO (tiene inspeccionId) — sube directo a
// Storage al elegir/tomar la foto. Para elegir fotos ANTES de guardar el
// formulario, ver EvidenciaPicker.jsx.
export default function EvidenciaUploader({ inspeccionId, evidencias = [], currentUser, onChange, canEdit = true }) {
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(blob) {
    setUploading(true);
    setError("");
    const result = await subirEvidencia(inspeccionId, blob, currentUser);
    setUploading(false);
    if (!result.ok) { setError("No se pudo subir la foto."); return; }
    onChange?.();
  }

  async function handleFileInput(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const blob = await fileToResizedBlob(file);
    handleUpload(blob);
  }

  async function handleDelete(evidencia) {
    if (!window.confirm("¿Quitar esta evidencia?")) return;
    await eliminarEvidencia(evidencia);
    onChange?.();
  }

  return (
    <div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-xl border border-[#edf0f4] bg-white px-3 py-1.5 text-xs font-medium text-[#0f1f3d] shadow-[0_1px_2px_rgba(11,31,58,0.08)] transition hover:border-[#f0d885] active:scale-[0.98]">
            📎 Subir foto
            <input type="file" accept="image/*" className="hidden" onChange={handleFileInput} disabled={uploading} />
          </label>
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            disabled={uploading}
            className="rounded-xl border border-[#edf0f4] bg-white px-3 py-1.5 text-xs font-medium text-[#0f1f3d] shadow-[0_1px_2px_rgba(11,31,58,0.08)] transition hover:border-[#f0d885] active:scale-[0.98]"
          >
            📷 Tomar foto
          </button>
          {uploading && <span className="text-xs font-medium text-[#94a3b8]">Subiendo…</span>}
        </div>
      )}
      {error && <p className="mt-1 text-[10px] font-bold text-red-500">{error}</p>}
      {evidencias.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {evidencias.map((ev) => (
            <div key={ev.id} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
              <a href={ev.url} target="_blank" rel="noreferrer">
                <img src={ev.url} alt="Evidencia" className="h-full w-full object-cover" />
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(ev)}
                  className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl bg-red-600/90 text-[9px] font-black text-white opacity-0 transition group-hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {showCamera && (
        <CameraCaptureModal
          onCapture={(blob) => { setShowCamera(false); handleUpload(blob); }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
