'use client';

import React, { useState, useEffect, useRef } from 'react';
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

  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMemberMenuOpen(false);
      }
    };
    if (memberMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [memberMenuOpen]);

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
    setCurrentUserState(updated);
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
    await Api.updateMember(updated);
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
      case 'vacation':
        return <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">🌴 Urlaub</span>;
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors group shadow-md"
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
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMemberMenuOpen(!memberMenuOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-colors shadow-md"
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
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/95 py-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Active Member Status Switcher */}
                <div className="px-3.5 py-2 border-b border-slate-800">
                  <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Dein Status ({currentUser?.name || user?.name}):
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleQuickStatusChange('home', 'Zuhause')}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                        currentUser?.status === 'home'
                          ? 'bg-emerald-500/25 text-emerald-200 border-emerald-500/60 font-bold shadow-sm'
                          : 'text-slate-300 bg-slate-800/80 border-slate-700 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <span>🏠</span> Zuhause
                    </button>
                    <button
                      onClick={() => handleQuickStatusChange('away', 'Unterwegs')}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                        currentUser?.status === 'away'
                          ? 'bg-amber-500/25 text-amber-200 border-amber-500/60 font-bold shadow-sm'
                          : 'text-slate-300 bg-slate-800/80 border-slate-700 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <span>🚗</span> Unterwegs
                    </button>
                    <button
                      onClick={() => handleQuickStatusChange('work', 'Im Büro')}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                        currentUser?.status === 'work'
                          ? 'bg-blue-500/25 text-blue-200 border-blue-500/60 font-bold shadow-sm'
                          : 'text-slate-300 bg-slate-800/80 border-slate-700 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <span>💼</span> Im Büro
                    </button>
                    <button
                      onClick={() => handleQuickStatusChange('school', 'In der Schule')}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                        currentUser?.status === 'school'
                          ? 'bg-purple-500/25 text-purple-200 border-purple-500/60 font-bold shadow-sm'
                          : 'text-slate-300 bg-slate-800/80 border-slate-700 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <span>📚</span> Schule
                    </button>
                  </div>
                </div>

                {/* Profile Switcher */}
                {members.length > 1 && (
                  <>
                    <div className="px-3.5 py-2 border-b border-slate-800">
                      <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Profil wechseln</p>
                    </div>
                    <div className="p-1.5 space-y-1">
                      {members.map(m => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectMember(m.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                            currentUser?.id === m.id
                              ? 'bg-emerald-500/20 text-white font-bold border border-emerald-500/40'
                              : 'text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{m.avatar}</span>
                            <div>
                              <p className="font-semibold text-slate-100">{m.name}</p>
                              <p className="text-[10px] text-slate-400">{m.statusMessage || (m.status === 'home' ? 'Zuhause' : m.status === 'work' ? 'Im Büro' : m.status === 'school' ? 'In der Schule' : 'Unterwegs')}</p>
                            </div>
                          </div>
                          {currentUser?.id === m.id && <Check className="w-4 h-4 text-emerald-400" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Household Info */}
                <div className="px-3.5 py-2 border-t border-slate-800 text-xs text-slate-300">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Angemeldet als:</p>
                  <p className="text-slate-100 font-semibold truncate">{user?.email}</p>
                </div>

                {/* Logout Action */}
                <div className="p-1.5 border-t border-slate-800">
                  <button
                    onClick={handleLogoutClick}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 transition-colors font-bold"
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
