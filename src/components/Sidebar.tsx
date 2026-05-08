import { Activity, LayoutDashboard, ClipboardList, FileText, MessageCircle, LogOut, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Page = 'dashboard' | 'checkin' | 'reports' | 'chat';

type Props = {
  currentPage: Page;
  onNavigate: (page: Page) => void;
};

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'checkin', label: 'Daily Check-in', icon: ClipboardList },
  { id: 'reports', label: 'Health Reports', icon: FileText },
  { id: 'chat', label: 'AI Assistant', icon: MessageCircle },
];

export default function Sidebar({ currentPage, onNavigate }: Props) {
  const { profile } = useAuth();

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <aside className="w-64 bg-[#080f1e] border-r border-white/5 flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">LifeOS</span>
        </div>
      </div>

      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
          <div className="w-9 h-9 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 border border-cyan-500/20 rounded-lg flex items-center justify-center">
            <span className="text-cyan-400 font-semibold text-sm">
              {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
            <p className="text-slate-500 text-xs capitalize">{profile?.activity_level || 'Active'} lifestyle</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
              currentPage === id
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {currentPage === id && <ChevronRight className="w-3 h-3 opacity-50" />}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/5 text-sm font-medium transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
