import { useState } from "react";

import AppRouter from "./core/routing/AppRouter";
import LoginModule from "./modules/auth/LoginModule";
import { getSession, clearSession } from "./services/authService";

export default function App() {
  const [currentUser, setCurrentUser] = useState(getSession());

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

  return (
    <AppRouter
      currentUser={currentUser}
      onLogout={handleLogout}
    />
  );
}