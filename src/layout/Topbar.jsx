import { useLocation } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import MessagesPanel from "../components/MessagesPanel";

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

  // En móvil no hay espacio para el nombre completo del portal sin empujar
  // campana/mensajes/Salir a una segunda fila — pedido explícito de que este
  // acortamiento sea SOLO en móvil; en escritorio la página "sin título
  // propio" conserva el nombre completo (las páginas con pageTitle
  // específico no cambian en ningún tamaño).
  const specificTitle = pageTitles[pathname];

  return (
    <header className="flex min-h-[64px] flex-nowrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2 sm:min-h-[82px] sm:gap-3 sm:px-8 sm:py-0">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
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
            {specificTitle || (
              <>
                <span className="sm:hidden">Portal</span>
                <span className="hidden sm:inline">Portal Estratégico Vikingo</span>
              </>
            )}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <NotificationBell currentUser={currentUser} />
        <MessagesPanel currentUser={currentUser} />

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
