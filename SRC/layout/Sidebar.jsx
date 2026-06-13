import { NavLink } from "react-router-dom";

const menuItems = [
  { label: "Inicio Ejecutivo", route: "/" },
  { label: "Desempeño Organizacional", route: "/performance" },
  { label: "Seguimiento Estratégico", route: "/strategic-followup" },
  { label: "Diseño organizacional", route: "/capacity" },
  { label: "Balance de Carga", route: "/workload-balance" },
  { label: "Centro de Decisiones", route: "/decision-center" },
  { label: "Vista Proceso", route: "/process-view" },
  { label: "Vista Responsable", route: "/responsible-view" },
  { label: "Madurez Organizacional", route: "/maturity" },
  { label: "Diagnóstico SIG", route: "/sig" },
  { label: "Catálogo Organizacional", route: "/organization-catalog" },
  { label: "Memoria Organizacional", route: "/memory" },
  { label: "IA Vikingo", route: "/ai-vikingo" },
];

const restrictedRoles = ["PM", "Analista de Procesos"];

const allowedForRestricted = [
  "Diseño organizacional",
  "Catálogo Organizacional",
  "Balance de Carga",
  "Madurez Organizacional",
  "Diagnóstico SIG",
];

function getUserRole(currentUser) {
  return (
    currentUser?.rol_organizacional ||
    currentUser?.rol_sistema ||
    currentUser?.role ||
    ""
  );
}

export default function Sidebar({ currentUser }) {
  const userRole = getUserRole(currentUser);
  const isRestrictedUser = restrictedRoles.includes(userRole);

  const visibleMenuItems = isRestrictedUser
    ? menuItems.filter((item) => allowedForRestricted.includes(item.label))
    : menuItems;

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