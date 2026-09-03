import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MeetingAttendanceAlarm from "../components/MeetingAttendanceAlarm";

export default function AppLayout({
  children,
  currentUser,
  onLogout,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Cerrar el menú automáticamente al navegar a otra ruta (además del
  // cierre directo al hacer clic en un ítem, por si la navegación viene de
  // otro lado, ej. un botón dentro de un módulo).
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen w-screen overflow-hidden bg-[#f4f6f8]">
      <Sidebar currentUser={currentUser} open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          currentUser={currentUser}
          onLogout={onLogout}
          onMenuClick={() => setMenuOpen((v) => !v)}
        />

        <main className="min-w-0 flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>

      <MeetingAttendanceAlarm currentUser={currentUser} />
    </div>
  );
}