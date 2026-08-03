import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "../../layout/AppLayout";
import { canViewModule } from "../../services/permissionsService";

import ExecutiveHome from "../../modules/executive/ExecutiveHome";
import PerformanceModule from "../../modules/performance/PerformanceModule";
import StrategicDeploymentModule from "../../modules/StrategicDeploymentModule";
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

export default function AppRouter({
  currentUser,
  onLogout,
}) {
  const restrictedStart = !canViewModule(currentUser, "home");

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
                <Navigate to="/capacity" replace />
              ) : (
                <ExecutiveHome currentUser={currentUser} />
              )
            }
          />

          <Route
            path="/performance"
            element={<PerformanceModule currentUser={currentUser} />}
          />

<Route
  path="/strategic-deployment"
  element={<StrategicDeploymentModule currentUser={currentUser} />}
/>

          <Route
            path="/capacity"
            element={<CapacityModule currentUser={currentUser} />}
          />

          <Route
            path="/decision-center"
            element={
              canViewModule(currentUser, "decision-center") ? (
                <DecisionCenterModule currentUser={currentUser} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/strategic-followup"
            element={<StrategicFollowupModule currentUser={currentUser} />}
          />

          <Route
            path="/acciones"
            element={
              canViewModule(currentUser, "acciones") ? (
                <ActionsModule currentUser={currentUser} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />



          <Route
            path="/organigrama"
            element={<OrganigramaModule currentUser={currentUser} />}
          />

          <Route
            path="/organization-catalog"
            element={<OrganizationCatalogModule />}
          />

          <Route
            path="/competencias/:id"
            element={<CompetenciaDetailPage currentUser={currentUser} />}
          />

          <Route
            path="/workload-balance"
            element={<WorkloadBalanceModule currentUser={currentUser} />}
          />

          <Route
            path="/maturity"
            element={<MaturityModule />}
          />

          <Route
            path="/sig"
            element={<SigDiagnosisModule />}
          />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
