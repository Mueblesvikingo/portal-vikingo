import { useEffect, useRef, useState } from "react";
import { subirEvidencia, eliminarEvidencia } from "../../services/calidadService";

// Redimensiona cualquier imagen (de archivo o de cámara) al lado más largo
// máximo antes de subir — mismo espíritu que el paso de recorte de CORELI,
// pero sin forzar cuadrado: una foto de un defecto rara vez es cuadrada.
const MAX_DIM = 1600;

function resizeToBlob(sourceCanvasOrImg, naturalW, naturalH) {
  const scale = Math.min(1, MAX_DIM / Math.max(naturalW, naturalH));
  const w = Math.round(naturalW * scale);
  const h = Math.round(naturalH * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(sourceCanvasOrImg, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

function fileToResizedBlob(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      const blob = await resizeToBlob(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Modal de cámara en vivo — mismo patrón que CORELI (getUserMedia + dibujar
// el frame de <video> en <canvas>), evita los bugs de rotación EXIF del
// atributo `capture` nativo en iOS Safari.
function CameraCaptureModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError("No se pudo acceder a la cámara. Revisa permisos del navegador."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  async function handleCapture() {
    const video = videoRef.current;
    if (!video) return;
    const blob = await resizeToBlob(video, video.videoWidth, video.videoHeight);
    onCapture(blob);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-3">
      {error ? (
        <p className="text-center text-sm font-bold text-white">{error}</p>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="max-h-[70vh] w-full max-w-lg rounded-xl bg-black object-contain" />
      )}
      <div className="mt-4 flex gap-3">
        <button type="button" onClick={onClose} className="rounded-lg border border-white/30 px-4 py-2 text-[11px] font-black text-white">Cancelar</button>
        {!error && (
          <button type="button" onClick={handleCapture} className="rounded-lg bg-white px-5 py-2 text-[11px] font-black text-slate-900">📷 Capturar</button>
        )}
      </div>
    </div>
  );
}

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
