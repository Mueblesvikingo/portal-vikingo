import { useEffect, useState } from "react";

import AppRouter from "./core/routing/AppRouter";
import LoginModule from "./modules/auth/LoginModule";
import { getSession, clearSession } from "./services/authService";
import { loadRolePermissionDefaults } from "./services/permissionsService";

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