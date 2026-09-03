import { NavLink } from "react-router-dom";
import { canViewModule } from "../services/permissionsService";

const menuItems = [
  // Temporal: Inicio Ejecutivo se oculta del menú mientras se pule.
  // Restaurar esta línea arriba de Centro de Decisiones cuando esté listo.
  // { label: "Inicio Ejecutivo", route: "/", moduleKey: "home" },
  { label: "Centro de Decisiones", route: "/decision-center", moduleKey: "decision-center" },
  { label: "Seguimiento Estratégico", route: "/strategic-followup", moduleKey: "strategic-followup" },
  { label: "S&OP", route: "/sop", moduleKey: "sop" },
  { label: "Desempeño Organizacional", route: "/performance", moduleKey: "performance" },
  { label: "Diseño organizacional", route: "/capacity", moduleKey: "capacity" },
  { label: "Balance de Carga", route: "/workload-balance", moduleKey: "workload-balance" },
  { label: "Organigrama", route: "/organigrama", moduleKey: "organigrama" },
  { label: "Acciones de Mejora", route: "/acciones", moduleKey: "acciones" },
  { label: "Madurez Organizacional", route: "/maturity", moduleKey: "maturity" },
  { label: "Diagnóstico SIG", route: "/sig", moduleKey: "sig" },
  { label: "Catálogo Organizacional", route: "/organization-catalog", moduleKey: "organization-catalog" },
];

// En pantallas < lg es un cajón (drawer) que se desliza sobre el
// contenido, controlado por `open`/`onClose` desde AppLayout (que a su vez
// lo abre con el botón de hamburguesa del Topbar). En lg+ vuelve a ser el
// panel fijo de siempre — mismas clases, solo con el transform anulado.
export default function Sidebar({ currentUser, open, onClose }) {
  const visibleMenuItems = menuItems.filter((item) => canViewModule(currentUser, item.moduleKey));

  return (
    <>
      {open && (
        <div onClick={onClose} className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" aria-hidden="true" />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] min-h-screen flex-col bg-[#071226] text-white transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-[280px] lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between border-b border-white/10 p-6 lg:p-8">
          <div>
            <div className="text-2xl font-black tracking-wide lg:text-3xl">
              VIKIN<span className="text-red-500">GO</span>
            </div>
            <div className="mt-2 text-base font-bold lg:mt-3 lg:text-lg">Portal estratégico</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-auto p-4">
          {visibleMenuItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.route}
              end={item.route === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `block w-full text-left px-5 py-3 rounded-2xl transition-all text-sm font-semibold ${
                  isActive
                    ? "bg-red-600 text-white shadow-lg"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
