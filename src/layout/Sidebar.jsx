import { NavLink } from "react-router-dom";
import { canViewModule } from "../services/permissionsService";

const menuItems = [
  // Temporal: Inicio Ejecutivo se oculta del menú mientras se pule.
  // Restaurar esta línea arriba de Centro de Decisiones cuando esté listo.
  // { label: "Inicio Ejecutivo", route: "/", moduleKey: "home" },
  { label: "Centro de Decisiones", route: "/decision-center", moduleKey: "decision-center" },
  { label: "Seguimiento Estratégico", route: "/strategic-followup", moduleKey: "strategic-followup" },
  { label: "Despliegue Estratégico", route: "/strategic-deployment", moduleKey: "strategic-deployment" },
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

export default function Sidebar({ currentUser }) {
  const visibleMenuItems = menuItems.filter((item) => canViewModule(currentUser, item.moduleKey));

  return (
    <aside className="w-[280px] min-h-screen bg-[#071226] text-white flex flex-col">
      <div className="p-8 border-b border-white/10">
        <div className="text-3xl font-black tracking-wide">
          VIKIN<span className="text-red-500">GO</span>
        </div>

        <div className="mt-3 text-lg font-bold">Portal estratégico</div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-auto">
        {visibleMenuItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.route}
            end={item.route === "/"}
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
  );
}
