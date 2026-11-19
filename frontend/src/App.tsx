import { HashRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import type { StaffRole } from "./api/types";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/ui";
import { LoginPage } from "./pages/LoginPage";
import { NewOrderPage } from "./pages/NewOrderPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { PatientReportPage, PdfPreviewPage } from "./pages/PdfPreviewPage";
import { PatientsPage } from "./pages/PatientsPage";
import { ReportEditorPage } from "./pages/ReportEditorPage";
import { StaffPage } from "./pages/StaffPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { WorklistPage } from "./pages/WorklistPage";

function RequireStaff() {
  const { token, user, loading } = useAuth();
  if (loading) {
    return <main className="auth-page"><LoadingState label="Restoring your session…" /></main>;
  }
  return token && user ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireRole({ roles }: { roles: StaffRole[] }) {
  const { user } = useAuth();
  return user && roles.includes(user.role)
    ? <Outlet />
    : <Navigate to="/app/worklist" replace />;
}

function RouteMap() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/patient-report" element={<PatientReportPage />} />
      <Route element={<RequireStaff />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="worklist" replace />} />
          <Route path="worklist" element={<WorklistPage />} />
          <Route path="orders/new" element={
            <RequireRole roles={["front_desk", "facility_admin"]} />
          }>
            <Route index element={<NewOrderPage />} />
          </Route>
          <Route path="orders/:orderId" element={<OrderDetailPage />} />
          <Route path="orders/:orderId/report" element={
            <RequireRole roles={["radiologist", "facility_admin"]} />
          }>
            <Route index element={<ReportEditorPage />} />
          </Route>
          <Route path="reports/:versionId/pdf" element={<PdfPreviewPage />} />
          <Route element={<RequireRole roles={["front_desk", "facility_admin"]} />}>
            <Route path="patients" element={<PatientsPage />} />
          </Route>
          <Route element={<RequireRole roles={["facility_admin"]} />}>
            <Route path="staff" element={<StaffPage />} />
            <Route path="templates" element={<TemplatesPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/app/worklist" replace />} />
      <Route path="*" element={<Navigate to="/app/worklist" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <RouteMap />
      </AuthProvider>
    </HashRouter>
  );
}
