import { useLocation } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";

const pageTitles = {
  "/": "Inicio Ejecutivo",
  "/performance": "Desempeño Organizacional",
  "/strategic-followup": "Seguimiento Estratégico",
  "/capacity": "Diseño organizacional",
  "/organization-catalog": "Catálogo Organizacional",
  "/workload-balance": "Balance de Carga",
  "/decision-center": "Centro de Decisiones",
  "/maturity": "Madurez Organizacional",
  "/sig": "Diagnóstico SIG",
};

export default function Topbar({
  currentUser,
  onLogout,
  onMenuClick,
}) {
  const { pathname } = useLocation();

  const pageTitle =
    pageTitles[pathname] ||
    "Portal Estratégico Vikingo";

  return (
    <header className="flex min-h-[64px] flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-gray-200 bg-white px-3 py-2 sm:min-h-[82px] sm:px-8 sm:py-0">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menú"
          className="shrink-0 rounded-lg border border-gray-200 p-2 text-[#0f172a] hover:bg-gray-50 lg:hidden"
        >
          ☰
        </button>
        <div className="min-w-0">
          <div className="hidden text-xs uppercase tracking-[0.25em] font-black text-gray-400 sm:block">
            Portal de Desempeño Organizacional
          </div>

          <h1 className="truncate text-xl font-black leading-tight text-[#0f172a] sm:mt-1 sm:text-2xl lg:text-4xl lg:leading-none">
            {pageTitle}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <NotificationBell currentUser={currentUser} />

        <div className="hidden text-right sm:block">
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
          className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-red-700 sm:px-4 sm:text-base"
        >
          Salir
        </button>
      </div>
    </header>
  );
}
