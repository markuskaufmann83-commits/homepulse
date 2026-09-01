'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { DashboardView } from '../components/DashboardView';
import { ShoppingList } from '../components/ShoppingList';
import { CalendarView } from '../components/CalendarView';
import { FamilyFeed } from '../components/FamilyFeed';
import { MemberManager } from '../components/MemberManager';
import { VoiceAssistant } from '../components/VoiceAssistant';
import { PremiumModal } from '../components/PremiumModal';
import { AuthView } from '../components/AuthView';
import { getAuthSession } from '../lib/storage';
import { AuthService } from '../lib/auth';
import { AuthSession } from '../lib/types';
import {
  LayoutDashboard,
  ShoppingCart,
  Calendar,
  MessageSquare,
  Users
} from 'lucide-react';

export default function Home() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isPremiumOpen, setIsPremiumOpen] = useState<boolean>(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState<boolean>(false);

  // Check authentication session on mount
  useEffect(() => {
    const currentSession = getAuthSession();
    setSession(currentSession);
    setIsAuthChecked(true);

    if (currentSession) {
      AuthService.syncSession(currentSession).catch(() => {});
    }

    const handleDataChange = (e: any) => {
      if (e?.detail?.resource === 'auth') {
        const s = getAuthSession();
        setSession(s);
        if (s) {
          AuthService.syncSession(s).catch(() => {});
        }
      }
    };

    window.addEventListener('homepulse-data-change', handleDataChange);
    return () => window.removeEventListener('homepulse-data-change', handleDataChange);
  }, []);

  // Sync tab with URL query parameter & browser history
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam && ['dashboard', 'shopping', 'calendar', 'feed', 'members'].includes(tabParam)) {
        setActiveTab(tabParam);
      }

      const handlePopState = () => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab') || 'dashboard';
        setActiveTab(tab);
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tabId === 'dashboard') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', tabId);
      }
      window.history.pushState({}, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAuthSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setSession(null);
  };

  const tabs = [
    { id: 'dashboard', label: 'Übersicht', icon: LayoutDashboard },
    { id: 'shopping', label: 'Einkauf', icon: ShoppingCart },
    { id: 'calendar', label: 'Kalender', icon: Calendar },
    { id: 'feed', label: 'Pinnwand', icon: MessageSquare },
    { id: 'members', label: 'Familie', icon: Users }
  ];

  if (!isAuthChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If not logged in, render Authentication Screen
  if (!session) {
    return <AuthView onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <Header
        onOpenPremium={() => setIsPremiumOpen(true)}
        onNavigateTab={tab => handleTabChange(tab)}
        onLogout={handleLogout}
      />

      {/* Desktop & Tablet Navigation Bar */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4 hidden md:block">
        <nav className="flex items-center gap-1 p-1.5 rounded-2xl glass-panel border border-white/10 w-fit">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigateTab={tab => handleTabChange(tab)}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onOpenPremium={() => setIsPremiumOpen(true)}
          />
        )}

        {activeTab === 'shopping' && <ShoppingList onOpenVoice={() => setIsVoiceOpen(true)} />}
        {activeTab === 'calendar' && <CalendarView onOpenVoice={() => setIsVoiceOpen(true)} />}
        {activeTab === 'feed' && <FamilyFeed />}
        {activeTab === 'members' && <MemberManager />}
      </main>

      {/* Floating AI Voice Assistant */}
      <VoiceAssistant
        isOpen={isVoiceOpen}
        onOpenChange={open => setIsVoiceOpen(open)}
        onActionCompleted={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('homepulse-data-change', { detail: { resource: 'all' } }));
          }
        }}
      />

      {/* Google Play In-App Purchase Modal */}
      <PremiumModal
        isOpen={isPremiumOpen}
        onClose={() => setIsPremiumOpen(false)}
      />

      {/* Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden glass-panel border-t border-white/10 px-2 py-2">
        <div className="flex items-center justify-around">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                  isActive
                    ? 'text-emerald-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
