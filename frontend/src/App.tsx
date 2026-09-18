import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { lazyPage } from './components/LazyPage';

const LoginPage = lazyPage(() => import('./pages/LoginPage'), 'Loading sign in');
const OverviewPage = lazyPage(() => import('./pages/OverviewPage'), 'Loading overview');
const UsersPage = lazyPage(() => import('./pages/UsersPage'), 'Loading users');
const PerformancePage = lazyPage(() => import('./pages/PerformancePage'), 'Loading performance');
const RulesPage = lazyPage(() => import('./pages/RulesPage'), 'Loading rules');
const AuditPage = lazyPage(() => import('./pages/AuditPage'), 'Loading audit');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/app" element={<AdminLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="performance" element={<PerformancePage />} />
                <Route path="rules" element={<RulesPage />} />
                <Route path="audit" element={<AuditPage />} />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
