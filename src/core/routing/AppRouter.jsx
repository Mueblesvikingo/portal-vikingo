import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "../../layout/AppLayout";

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

function shouldStartInCapacity(currentUser) {
  const role = currentUser?.rol_organizacional || "";

  return role === "PM" || role === "Analista de Procesos";
}

export default function AppRouter({
  currentUser,
  onLogout,
}) {
  const restrictedStart = shouldStartInCapacity(currentUser);

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
                <ExecutiveHome />
              )
            }
          />

          <Route
            path="/performance"
            element={<PerformanceModule />}
          />

<Route
  path="/strategic-deployment"
  element={<StrategicDeploymentModule />}
/>

          <Route
            path="/capacity"
            element={<CapacityModule />}
          />

          <Route
            path="/decision-center"
            element={<DecisionCenterModule />}
          />

          <Route
            path="/strategic-followup"
            element={<StrategicFollowupModule />}
          />



          <Route
            path="/organization-catalog"
            element={<OrganizationCatalogModule />}
          />

          <Route
            path="/workload-balance"
            element={<WorkloadBalanceModule />}
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