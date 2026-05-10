import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminCompanies from './pages/admin/AdminCompanies';
import AdminCompanyDetail from './pages/admin/AdminCompanyDetail';
import AdminStats from './pages/admin/AdminStats';
import AdminSubscriptions from './pages/admin/AdminSubscriptions';
import AdminActivity from './pages/admin/AdminActivity';
import AdminTransactions from './pages/admin/AdminTransactions';
import AdminHealth from './pages/admin/AdminHealth';
import CompanyLayout from './pages/company/CompanyLayout';
import CompanyDashboard from './pages/company/CompanyDashboard';
import CompanyOffices from './pages/company/CompanyOffices';
import CompanyStaff from './pages/company/CompanyStaff';
import CompanyParcels from './pages/company/CompanyParcels';
import CompanyMpesa from './pages/company/CompanyMpesa';
import CompanySubscription from './pages/company/CompanySubscription';
import CompanyLogs from './pages/company/CompanyLogs';
import OfficeLayout from './pages/office/OfficeLayout';
import OfficeDashboard from './pages/office/OfficeDashboard';
import OfficeRevenue from './pages/office/OfficeRevenue';
import CreateParcel from './pages/office/CreateParcel';
import OfficeParcels from './pages/office/OfficeParcels';
import ParcelDetail from './pages/ParcelDetail';
import ScanPage from './pages/ScanPage';
import PrintPage from './pages/PrintPage';
import OfficeSuspended from './pages/office/OfficeSuspended';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
}

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'super_admin') return <Navigate to="/admin" replace />;
  if (user.role === 'company_admin') return <Navigate to="/company" replace />;
  if (user.role === 'office_staff') return <Navigate to="/office" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ className: 'font-sans text-sm' }} />
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<RoleRedirect />} />

          {/* Super Admin */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['super_admin']}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<AdminStats />} />
            <Route path="companies" element={<AdminCompanies />} />
            <Route path="companies/:id" element={<AdminCompanyDetail />} />
            <Route path="stats" element={<AdminStats />} />
            <Route path="subscriptions" element={<AdminSubscriptions />} />
            <Route path="activity" element={<AdminActivity />} />
            <Route path="transactions" element={<AdminTransactions />} />
            <Route path="health" element={<AdminHealth />} />
          </Route>

          {/* Company Admin */}
          <Route path="/company" element={<ProtectedRoute allowedRoles={['company_admin']}><CompanyLayout /></ProtectedRoute>}>
            <Route index element={<CompanyDashboard />} />
            <Route path="offices" element={<CompanyOffices />} />
            <Route path="staff" element={<CompanyStaff />} />
            <Route path="parcels" element={<CompanyParcels />} />
            <Route path="mpesa" element={<CompanyMpesa />} />
            <Route path="subscription" element={<CompanySubscription />} />
            <Route path="logs" element={<CompanyLogs />} />
          </Route>

          {/* Office Staff */}
          <Route path="/office" element={<ProtectedRoute allowedRoles={['office_staff', 'company_admin']}><OfficeLayout /></ProtectedRoute>}>
            <Route index element={<OfficeDashboard />} />
            <Route path="create-parcel" element={<CreateParcel />} />
            <Route path="parcels" element={<OfficeParcels />} />
            <Route path="revenue" element={<OfficeRevenue />} />
          </Route>

          {/* Shared */}
          <Route path="/suspended" element={<ProtectedRoute allowedRoles={['office_staff']}><OfficeSuspended /></ProtectedRoute>} />
          <Route path="/parcel/:id" element={<ProtectedRoute allowedRoles={['office_staff', 'company_admin', 'super_admin']}><ParcelDetail /></ProtectedRoute>} />
          <Route path="/scan" element={<ProtectedRoute allowedRoles={['office_staff', 'company_admin']}><ScanPage /></ProtectedRoute>} />
          <Route path="/print/:id" element={<ProtectedRoute allowedRoles={['office_staff', 'company_admin']}><PrintPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
