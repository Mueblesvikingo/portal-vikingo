import { useEffect, useState } from "react";

import AppRouter from "./core/routing/AppRouter";
import LoginModule from "./modules/auth/LoginModule";
import { getSession, clearSession, marcarActividad, sesionSigueActiva } from "./services/authService";
import { loadRolePermissionDefaults } from "./services/permissionsService";

const HEARTBEAT_MS = 45000;

export default function App() {
  const [currentUser, setCurrentUser] = useState(getSession());
  const [permissionsReady, setPermissionsReady] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    setPermissionsReady(false);

    loadRolePermissionDefaults().finally(() => {
      if (!cancelled) setPermissionsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  // Heartbeat de presencia para "en línea" en Mensajes — ver marcarActividad
  // en authService.js.
  // En el mismo latido se comprueba que el usuario siga activo: si lo
  // desactivaron en Catálogo Organizacional, su sesión abierta se cierra.
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    let cancelled = false;
    async function latido() {
      if (!(await sesionSigueActiva(currentUser.id))) {
        if (!cancelled) {
          clearSession();
          setCurrentUser(null);
        }
        return;
      }
      marcarActividad(currentUser.id);
    }
    latido();
    const interval = setInterval(latido, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUser?.id]);

  function handleLogin(user) {
    setCurrentUser(user);
  }

  function handleLogout() {
    clearSession();
    setCurrentUser(null);
  }

  if (!currentUser) {
    return <LoginModule onLogin={handleLogin} />;
  }

  if (!permissionsReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] text-sm font-semibold text-slate-500">
        Cargando permisos...
      </div>
    );
  }

  return (
    <AppRouter
      currentUser={currentUser}
      onLogout={handleLogout}
    />
  );
}