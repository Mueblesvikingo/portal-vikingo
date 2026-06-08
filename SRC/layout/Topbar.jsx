import { useLocation } from "react-router-dom";

const pageTitles = {
  "/": "Inicio Ejecutivo",
  "/performance": "Desempeño Organizacional",
  "/strategic-followup": "Seguimiento Estratégico",
  "/capacity": "Diseño organizacional",
  "/organization-catalog": "Catálogo Organizacional",
  "/workload-balance": "Balance de Carga",
  "/decision-center": "Centro de Decisiones",
  "/process-view": "Vista Proceso",
  "/responsible-view": "Vista Responsable",
  "/maturity": "Madurez Organizacional",
  "/sig": "Diagnóstico SIG",
  "/memory": "Memoria Organizacional",
  "/ai-vikingo": "IA Vikingo",
};

export default function Topbar({
  currentUser,
  onLogout,
}) {
  const { pathname } = useLocation();

  const pageTitle =
    pageTitles[pathname] ||
    "Portal Estratégico Vikingo";

  return (
    <header className="h-[82px] bg-white border-b border-gray-200 px-8 flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] font-black text-gray-400">
          Portal de Desempeño Organizacional
        </div>

        <h1 className="mt-1 text-4xl font-black text-[#0f172a] leading-none">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-slate-400">
            Usuario activo
          </div>

          <div className="font-semibold text-slate-700">
            {currentUser?.nombre ||
              currentUser?.usuario ||
              "Usuario"}
          </div>
        </div>

        <button
          onClick={onLogout}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all"
        >
          Salir
        </button>
      </div>
    </header>
  );
}