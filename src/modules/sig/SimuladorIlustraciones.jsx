// Ilustraciones del Simulador en el estilo "Vikingo" de la apariencia de CORELI: emblema plano de
// aristas rectas, contorno fino #15191E y paleta de madera, acero, oro viejo, rojo sangre y pergamino.
// El cofre del veredicto es el mismo emblema de Finanzas de esa apariencia. Solo presentación.

const C = {
  tinta: "#15191E",
  madera: "#7E5B3C",
  maderaOscura: "#553B27",
  acero: "#8E9AA7",
  aceroOscuro: "#5D6873",
  aceroAzul: "#89A6B6",
  azulProfundo: "#57778A",
  oro: "#BE9640",
  oroClaro: "#D9B867",
  rojo: "#82231C",
  pergamino: "#DCD0B4",
};

// Trazo común del estilo: fino, esquinas rectas.
const Emblema = ({ viewBox, className, titulo, children }) => (
  <svg viewBox={viewBox} className={className} role="img" aria-label={titulo}>
    <g stroke={C.tinta} strokeWidth="4" strokeLinejoin="miter" strokeLinecap="square">{children}</g>
  </svg>
);

// Pergamino con sello de cera: el análisis que estás armando.
export function IlusAnalisis({ className = "h-12 w-12" }) {
  return (
    <Emblema viewBox="40 40 320 320" className={className} titulo="Análisis">
      <path d="M96 72 H304 V328 H96 Z" fill={C.pergamino} />
      <path d="M76 60 H324 V88 H76 Z M76 312 H324 V340 H76 Z" fill={C.madera} />
      <path d="M128 132 H272 M128 170 H272 M128 208 H232" fill="none" stroke={C.aceroOscuro} strokeWidth="10" />
      <path d="M228 238 L276 238 L290 270 L252 296 L214 270 Z" fill={C.rojo} />
      <circle cx="252" cy="266" r="10" fill={C.oro} />
    </Emblema>
  );
}

// Columnas de madera, acero y oro: el volumen de trabajo.
export function IlusVolumen({ className = "h-12 w-12" }) {
  return (
    <Emblema viewBox="46 92 308 260" className={className} titulo="Volumen">
      <path d="M72 224 H144 V336 H72 Z" fill={C.madera} />
      <path d="M164 164 H236 V336 H164 Z" fill={C.aceroAzul} />
      <path d="M256 96 H328 V336 H256 Z" fill={C.oro} />
      <path d="M50 334 H350 V348 H50 Z" fill={C.tinta} />
    </Emblema>
  );
}

// Moneda de oro con el porcentaje grabado: tasa e impuestos.
export function IlusSupuestos({ className = "h-12 w-12" }) {
  return (
    <Emblema viewBox="40 40 320 320" className={className} titulo="Supuestos financieros">
      <circle cx="200" cy="200" r="150" fill={C.acero} />
      <circle cx="200" cy="200" r="126" fill={C.oro} />
      <circle cx="200" cy="200" r="100" fill={C.oroClaro} />
      <path d="M150 260 L250 140" fill="none" stroke={C.tinta} strokeWidth="18" />
      <circle cx="156" cy="152" r="24" fill={C.maderaOscura} />
      <circle cx="244" cy="248" r="24" fill={C.maderaOscura} />
      <circle cx="340" cy="200" r="5" fill={C.aceroOscuro} /><circle cx="60" cy="200" r="5" fill={C.aceroOscuro} />
      <circle cx="200" cy="60" r="5" fill={C.aceroOscuro} /><circle cx="200" cy="340" r="5" fill={C.aceroOscuro} />
    </Emblema>
  );
}

// Plotter de acero con banda de oro y la hoja de pergamino saliendo: el equipo a evaluar.
export function IlusEquipo({ className = "h-12 w-12" }) {
  return (
    <Emblema viewBox="40 60 320 300" className={className} titulo="Equipo a evaluar">
      <path d="M140 196 H260 L284 350 H116 Z" fill={C.pergamino} />
      <path d="M150 248 H250 M156 290 H236" fill="none" stroke={C.aceroOscuro} strokeWidth="8" />
      <path d="M52 92 H348 V200 H52 Z" fill={C.aceroOscuro} />
      <path d="M52 92 H348 V118 H52 Z" fill={C.acero} />
      <path d="M52 176 H348 V200 H52 Z" fill={C.oro} />
      <path d="M84 132 H176 V164 H84 Z" fill={C.azulProfundo} />
      <circle cx="296" cy="148" r="14" fill={C.rojo} />
      <path d="M68 200 V272 H92 V200 M308 200 V272 H332 V200" fill={C.madera} />
    </Emblema>
  );
}

// Cofre: lleno de oro si la inversión conviene (emblema de Finanzas), cerrado y apagado si no.
export function IlusCofre({ conviene = true, className = "h-24 w-24" }) {
  const madera = conviene ? C.madera : "#8a8278";
  const tapa = conviene ? C.maderaOscura : "#6b655d";
  return (
    <Emblema viewBox="60 48 280 294" className={className} titulo={conviene ? "Conviene" : "No conviene"}>
      {conviene && (
        <>
          <circle cx="140" cy="98" r="26" fill={C.oro} />
          <circle cx="194" cy="80" r="28" fill={C.oroClaro} />
          <circle cx="250" cy="98" r="24" fill={C.oro} />
        </>
      )}
      <path d={conviene ? "M70 176 L92 112 H308 L330 176 Z" : "M64 170 L76 128 H324 L336 170 Z"} fill={tapa} />
      <path d="M64 170 H336 V338 H64 Z" fill={madera} />
      <path d="M80 220 H320 M80 268 H320 M80 312 H320" fill="none" stroke={tapa} strokeWidth="4" />
      <path d="M64 170 H336 V194 H64 Z" fill={C.acero} />
      <path d={conviene ? "M104 112 H130 V338 H104 Z M270 112 H296 V338 H270 Z" : "M104 128 H130 V338 H104 Z M270 128 H296 V338 H270 Z"} fill={C.acero} />
      <path d="M172 190 H228 V248 L200 262 L172 248 Z" fill={conviene ? C.oro : C.rojo} />
      <circle cx="200" cy="220" r="7" fill={C.tinta} />
    </Emblema>
  );
}

// Íconos de línea para las insignias redondas de los indicadores (24 × 24).
const Icono = ({ children, className = "h-4 w-4" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const IconoRendimiento = (p) => <Icono {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></Icono>;
export const IconoReloj = (p) => <Icono {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icono>;
export const IconoMeta = (p) => <Icono {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Icono>;
export const IconoEtiqueta = (p) => <Icono {...p}><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></Icono>;
export const IconoGrafica = (p) => <Icono {...p}><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></Icono>;
