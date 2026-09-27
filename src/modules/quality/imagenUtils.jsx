import { useEffect, useRef, useState } from "react";

// Redimensiona cualquier imagen (de archivo o de cámara) al lado más largo
// máximo antes de subir — mismo espíritu que el paso de recorte de CORELI,
// pero sin forzar cuadrado: una foto de un defecto rara vez es cuadrada.
// Compartido entre EvidenciaUploader (evidencia de un registro ya guardado)
// y EvidenciaPicker (fotos elegidas antes de guardar el formulario).
const MAX_DIM = 1600;

export function resizeToBlob(sourceCanvasOrImg, naturalW, naturalH) {
  const scale = Math.min(1, MAX_DIM / Math.max(naturalW, naturalH));
  const w = Math.round(naturalW * scale);
  const h = Math.round(naturalH * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(sourceCanvasOrImg, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

export function fileToResizedBlob(file) {
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
export function CameraCaptureModal({ onCapture, onClose }) {
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
