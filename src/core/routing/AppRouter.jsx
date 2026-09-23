import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "../../layout/AppLayout";
import { canViewModule, isDirectorGeneral } from "../../services/permissionsService";

import ExecutiveHome from "../../modules/executive/ExecutiveHome";
import PerformanceModule from "../../modules/performance/PerformanceModule";
import OperationalPerformanceModule from "../../modules/performance/OperationalPerformanceModule";
import CapacityModule from "../../modules/organizational-capacity/CapacityModule";
import DecisionCenterModule from "../../modules/decision-center/DecisionCenterModule";
import StrategicFollowupModule from "../../modules/strategic-followup/StrategicFollowupModule";
import WorkloadBalanceModule from "../../modules/WorkloadBalanceModule";
import MaturityModule from "../../modules/maturity/MaturityModule";
import SigDiagnosisModule from "../../modules/sig/SigDiagnosisModule";
import OrganizationCatalogModule from "../../modules/organization-catalog/OrganizationCatalogModule";
import ActionsModule from "../../modules/actions/ActionsModule";
import OrganigramaModule from "../../modules/organigrama/OrganigramaModule";
import CompetenciaDetailPage from "../../modules/competencias/CompetenciaDetailPage";
import SopModule from "../../modules/sop/SopModule";

// El Sidebar ya oculta los enlaces a los que un usuario no tiene acceso,
// pero eso no bloqueaba entrar por URL directa (marcador, historial del
// navegador, o una pestaña que quedó abierta desde antes de que le
// restringieran el menú) — cualquier ruta sin este guard se renderizaba
// igual sin importar el permiso. Se detectó porque a Joseline (rol
// operativo, solo debería ver Organigrama/Balance de Carga/Acciones) su
// navegador la llevó directo a "/performance". Todas las rutas del menú
// pasan ahora por el mismo chequeo que ya usa Sidebar.jsx (canViewModule).
function Guarded({ moduleKey, currentUser, children }) {
  return canViewModule(currentUser, moduleKey) ? children : <Navigate to="/" replace />;
}

export default function AppRouter({
  currentUser,
  onLogout,
}) {
  const restrictedStart = !canViewModule(currentUser, "home");
  const directorStart = isDirectorGeneral(currentUser);
  // Roles operativos (Supervisor/Auxiliar) no ven Diseño organizacional —
  // caerían en una ruta fuera de su menú si mandáramos "/capacity" a ciegas.
  const restrictedFallbackRoute = canViewModule(currentUser, "capacity") ? "/capacity" : "/workload-balance";

  return (
    <BrowserRouter>
      <AppLayout
        currentUser={currentUser}
        onLogout={onLogout}
      >
        <Routes>
          <Route
            path="/"
            element={
              restrictedStart ? (
                <Navigate to={restrictedFallbackRoute} replace />
              ) : directorStart ? (
                // Temporal: Inicio Ejecutivo se oculta mientras se pule —
                // Centro de Decisiones es el primer módulo que debe ver
                // Dirección. Revertir a <ExecutiveHome currentUser={currentUser} />
                // cuando Inicio Ejecutivo esté listo.
                <Navigate to="/decision-center" replace />
              ) : (
                // El resto del equipo estratégico (PM, Coordinador SIG,
                // Analista de Procesos, etc.) arranca en Balance de Carga —
                // Centro de Decisiones queda como vista de arranque exclusiva
                // de Dirección.
                <Navigate to="/workload-balance" replace />
              )
            }
          />

          <Route
            path="/performance"
            element={<Guarded moduleKey="performance" currentUser={currentUser}><PerformanceModule currentUser={currentUser} /></Guarded>}
          />

          <Route
            path="/operational-performance"
            element={<Guarded moduleKey="operational-performance" currentUser={currentUser}><OperationalPerformanceModule currentUser={currentUser} /></Guarded>}
          />

{/* Despliegue Estratégico ya no es un módulo aparte: vive como pestaña
    "🧭 Despliegue Estratégico" dentro de Desempeño Organizacional (scope
    Estratégico). La ruta se conserva como redirección por si algún enlace
    o marcador viejo apunta aquí directo. */}
<Route
  path="/strategic-deployment"
  element={<Navigate to="/performance" replace />}
/>

          <Route
            path="/capacity"
            element={<Guarded moduleKey="capacity" currentUser={currentUser}><CapacityModule currentUser={currentUser} /></Guarded>}
          />

          <Route
            path="/decision-center"
            element={<Guarded moduleKey="decision-center" currentUser={currentUser}><DecisionCenterModule currentUser={currentUser} /></Guarded>}
          />

          <Route
            path="/strategic-followup"
            element={<Guarded moduleKey="strategic-followup" currentUser={currentUser}><StrategicFollowupModule currentUser={currentUser} /></Guarded>}
          />

          <Route
            path="/acciones"
            element={<Guarded moduleKey="acciones" currentUser={currentUser}><ActionsModule currentUser={currentUser} /></Guarded>}
          />



          <Route
            path="/organigrama"
            element={<Guarded moduleKey="organigrama" currentUser={currentUser}><OrganigramaModule currentUser={currentUser} /></Guarded>}
          />

          <Route
            path="/organization-catalog"
            element={<Guarded moduleKey="organization-catalog" currentUser={currentUser}><OrganizationCatalogModule /></Guarded>}
          />

          <Route
            path="/competencias/:id"
            element={<CompetenciaDetailPage currentUser={currentUser} />}
          />

          <Route
            path="/sop"
            element={<Guarded moduleKey="sop" currentUser={currentUser}><SopModule currentUser={currentUser} /></Guarded>}
          />

          <Route
            path="/workload-balance"
            element={<Guarded moduleKey="workload-balance" currentUser={currentUser}><WorkloadBalanceModule currentUser={currentUser} /></Guarded>}
          />

          <Route
            path="/maturity"
            element={<Guarded moduleKey="maturity" currentUser={currentUser}><MaturityModule currentUser={currentUser} /></Guarded>}
          />

          <Route
            path="/sig"
            element={<Guarded moduleKey="sig" currentUser={currentUser}><SigDiagnosisModule currentUser={currentUser} /></Guarded>}
          />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
