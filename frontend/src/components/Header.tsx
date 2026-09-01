'use client';

import React, { useState, useEffect } from 'react';
import { FamilyMember, SubscriptionStatus, MemberStatus, Household, User, AuthSession } from '../lib/types';
import { getCurrentUser, setCurrentUser, loadMembers, loadSubscription, getAuthSession } from '../lib/storage';
import { AuthService } from '../lib/auth';
import { Api } from '../lib/api';
import {
  Sparkles,
  Check,
  Crown,
  Activity,
  LogOut,
  Copy,
  Home,
  Navigation,
  Briefcase,
  GraduationCap,
  ChevronDown,
  KeyRound
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface HeaderProps {
  onOpenPremium: () => void;
  onNavigateTab?: (tab: string) => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenPremium, onNavigateTab, onLogout }) => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [currentUser, setCurrentUserState] = useState<FamilyMember | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [user, setUser] = useState<AuthSession['user'] | null>(null);
  const [memberMenuOpen, setMemberMenuOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const refreshData = () => {
    const session = getAuthSession();
    if (session) {
      setHousehold(session.household);
      setUser(session.user);
    }
    const mems = loadMembers();
    setMembers(mems);
    const curr = getCurrentUser();
    setCurrentUserState(curr);
    setSubscription(loadSubscription());
  };

  useEffect(() => {
    refreshData();
    const handleDataChange = () => refreshData();
    window.addEventListener('homepulse-data-change', handleDataChange);
    return () => window.removeEventListener('homepulse-data-change', handleDataChange);
  }, []);

  const handleSelectMember = (id: string) => {
    setCurrentUser(id);
    setCurrentUserState(members.find(m => m.id === id) || null);
    setMemberMenuOpen(false);
  };

  const handleQuickStatusChange = async (status: MemberStatus, statusMessage: string) => {
    if (!currentUser) return;
    const updated = {
      ...currentUser,
      status,
      statusMessage,
      updatedAt: new Date().toISOString()
    };
    await Api.updateMember(updated);
    setCurrentUserState(updated);
  };

  const handleCopyInviteCode = () => {
    if (household?.inviteCode) {
      navigator.clipboard.writeText(household.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleLogoutClick = () => {
    if (confirm('Möchtest du dich wirklich abmelden?')) {
      AuthService.logout();
      setMemberMenuOpen(false);
      if (onLogout) onLogout();
      else window.location.reload();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'home':
        return <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">🏠 Zuhause</span>;
      case 'away':
        return <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">🚗 Unterwegs</span>;
      case 'work':
        return <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">💼 Büro</span>;
      case 'school':
        return <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">📚 Schule</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30">📍 Aktiv</span>;
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-white/10 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand & Household Name */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('dashboard')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform">
            <Activity className="w-5 h-5 text-white animate-pulse" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-300 bg-clip-text text-transparent">
                HomePulse
              </span>
              {subscription?.tier === 'family_plus' ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                  <Crown className="w-3 h-3 text-amber-400" />
                  Family Plus
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-300 font-medium hidden sm:block">
              {household?.name || 'Mein Haushalt'}
            </p>
          </div>
        </div>

        {/* Right Section: Invite Code, Member Selector & Upgrade */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Invite Code Badge with Copy */}
          {household?.inviteCode && (
            <button
              onClick={handleCopyInviteCode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-white/10 transition-colors group"
              title="Einladungscode für Familienmitglieder kopieren"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono text-[11px] font-bold text-emerald-300">{household.inviteCode}</span>
              <span className="text-[10px] text-slate-400 hidden md:inline">
                {copiedCode ? 'Kopiert! ✓' : 'Kopieren'}
              </span>
            </button>
          )}

          {/* Upgrade Button if Free */}
          {subscription?.tier !== 'family_plus' && (
            <button
              onClick={onOpenPremium}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-gradient-to-r from-amber-500/20 to-amber-600/30 hover:from-amber-500/30 hover:to-amber-600/40 text-amber-300 border border-amber-500/40 transition-all shadow-sm active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Plus Upgrade</span>
            </button>
          )}

          {/* Member Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setMemberMenuOpen(!memberMenuOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 transition-colors"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow"
                style={{ backgroundColor: `${currentUser?.color || '#3B82F6'}33`, borderColor: currentUser?.color || '#3B82F6', borderWidth: 1 }}
              >
                <span>{currentUser?.avatar || '👤'}</span>
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-medium text-white leading-tight">{currentUser?.name || user?.name || 'Profil'}</p>
                <div className="mt-0.5">{currentUser && getStatusBadge(currentUser.status)}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {memberMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-panel bg-slate-900/95 border border-white/15 shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Active Member Status Switcher */}
                <div className="px-3 py-2 border-b border-white/10">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Dein Status ({currentUser?.name || user?.name}):
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => handleQuickStatusChange('home', 'Zuhause')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 ${
                        currentUser?.status === 'home'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                          : 'text-slate-400 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <span>🏠</span> Zuhause
                    </button>
                    <button
                      onClick={() => handleQuickStatusChange('away', 'Unterwegs')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 ${
                        currentUser?.status === 'away'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                          : 'text-slate-400 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <span>🚗</span> Unterwegs
                    </button>
                    <button
                      onClick={() => handleQuickStatusChange('work', 'Im Büro')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 ${
                        currentUser?.status === 'work'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 font-bold'
                          : 'text-slate-400 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <span>💼</span> Büro
                    </button>
                    <button
                      onClick={() => handleQuickStatusChange('school', 'In der Schule')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 ${
                        currentUser?.status === 'school'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold'
                          : 'text-slate-400 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <span>📚</span> Schule
                    </button>
                  </div>
                </div>

                {/* Profile Switcher */}
                {members.length > 1 && (
                  <>
                    <div className="px-3 py-1.5 border-b border-white/10">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Profil wechseln</p>
                    </div>
                    <div className="p-1 space-y-1">
                      {members.map(m => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectMember(m.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                            currentUser?.id === m.id
                              ? 'bg-emerald-500/20 text-white font-medium border border-emerald-500/30'
                              : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{m.avatar}</span>
                            <div>
                              <p className="font-medium text-slate-100">{m.name}</p>
                              <p className="text-[10px] text-slate-400">{m.statusMessage || m.status}</p>
                            </div>
                          </div>
                          {currentUser?.id === m.id && <Check className="w-4 h-4 text-emerald-400" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Household Info */}
                <div className="px-3 py-2 border-t border-white/10 text-xs text-slate-400">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Angemeldet als:</p>
                  <p className="text-slate-200 font-medium truncate">{user?.email}</p>
                </div>

                {/* Logout Action */}
                <div className="p-1.5 border-t border-white/10">
                  <button
                    onClick={handleLogoutClick}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Abmelden</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
