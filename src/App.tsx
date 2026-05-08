import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import OnboardingStep2 from './pages/OnboardingStep2';
import OnboardingStep3 from './pages/OnboardingStep3';
import Dashboard from './pages/Dashboard';
import DailyCheckin from './pages/DailyCheckin';
import HealthReports from './pages/HealthReports';
import Chatbot from './pages/Chatbot';
import Sidebar from './components/Sidebar';

type Page = 'dashboard' | 'checkin' | 'reports' | 'chat';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060b14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading LifeOS...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  if (!profile || profile.onboarding_step === 1) return <OnboardingStep2 />;

  if (!profile.onboarding_complete) return <OnboardingStep3 />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#060b14]">
      <Sidebar currentPage={page} onNavigate={setPage} />
      {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
      {page === 'checkin' && <DailyCheckin />}
      {page === 'reports' && <HealthReports />}
      {page === 'chat' && <Chatbot />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
