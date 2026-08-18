// Catálogo único de los 16 procesos del portal y su líder — antes vivía
// solo dentro de SigDiagnosisModule.jsx; se centraliza aquí para que otros
// módulos (ej. Tablero Gerencial de Proyectos) usen la misma fuente en vez
// de mantener una copia propia que se desalinee con el tiempo.
export const mapProcesses = [
  "Planeación estratégica del SIG", "Planeación financiera", "Gestión de competencias", "Evaluación desempeño del SIG", "Ventas", "Ingeniería / Desarrollo de productos", "Compras", "Planeación y control de la producción", "Gestión de inventarios", "Control de almacenes", "Distribución", "Gestión de calidad", "Recursos humanos", "Gestión de Seguridad y Salud laboral", "Transformación Digital y Automatización", "Contabilidad y Cumplimiento Fiscal",
];

export const processLeaders = {
  "Planeación Estratégica": { role: "Coordinador Estratégico/SIG", person: "Cristian" },
  "Planeación estratégica del SIG": { role: "Coordinador Estratégico/SIG", person: "Cristian" },
  "Planeación financiera": { role: "Finanzas", person: "Samantha" },
  "Gestión competencias": { role: "Analista de talento", person: "Jacqueline" },
  "Gestión de competencias": { role: "Analista de talento", person: "Jacqueline" },
  "Evaluación desempeño": { role: "Coordinador Estratégico/SIG", person: "Cristian" },
  "Evaluación desempeño del SIG": { role: "Coordinador Estratégico/SIG", person: "Cristian" },
  Ventas: { role: "Director general", person: "Alejandro" },
  "Desarrollo de productos": { role: "Ingeniero de producto", person: "Beatriz" },
  "Ingeniería / Desarrollo de productos": { role: "Ingeniero de producto", person: "Beatriz" },
  Compras: { role: "Gerente Operaciones", person: "Hugo" },
  "Planeación producción": { role: "Gerente Operaciones", person: "Hugo" },
  "Planeación y control de la producción": { role: "Gerente Operaciones", person: "Hugo" },
  "Gestión de inventarios": { role: "Gerente Operaciones", person: "Hugo" },
  "Control de almacenes": { role: "Gerente Operaciones", person: "Hugo" },
  Distribución: { role: "Coordinador de Distribución", person: "Eduardo" },
  Calidad: { role: "Coordinador de Calidad", person: "Beatriz" },
  "Gestión de calidad": { role: "Coordinador de Calidad", person: "Beatriz" },
  "Producción/Calidad": { role: "Gerente Operaciones / Coordinador de Calidad", person: "Hugo / Beatriz" },
  "Recursos humanos": { role: "Recursos humanos", person: "Aurora" },
  "Gestión de Seguridad y Salud laboral": { role: "Coordinador SST", person: "Aurora" },
  "Transformación Digital y Automatización": { role: "Analista de procesos", person: "Elizabeth" },
  "Contabilidad y Cumplimiento Fiscal": { role: "Finanzas", person: "Samantha" },
  Dirección: { role: "Director general", person: "Dirección" },
  Todos: { role: "Transversal", person: "Multidisciplinario" },
};
