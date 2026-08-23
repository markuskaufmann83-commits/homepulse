'use client';

import React, { useState } from 'react';
import { Header } from '../components/Header';
import { DashboardView } from '../components/DashboardView';
import { ShoppingList } from '../components/ShoppingList';
import { CalendarView } from '../components/CalendarView';
import { FamilyFeed } from '../components/FamilyFeed';
import { MemberManager } from '../components/MemberManager';
import { VoiceAssistant } from '../components/VoiceAssistant';
import { PremiumModal } from '../components/PremiumModal';
import {
  LayoutDashboard,
  ShoppingCart,
  Calendar,
  MessageSquare,
  Users
} from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isPremiumOpen, setIsPremiumOpen] = useState<boolean>(false);

  const tabs = [
    { id: 'dashboard', label: 'Übersicht', icon: LayoutDashboard },
    { id: 'shopping', label: 'Einkauf', icon: ShoppingCart },
    { id: 'calendar', label: 'Kalender', icon: Calendar },
    { id: 'feed', label: 'Pinnwand', icon: MessageSquare },
    { id: 'members', label: 'Familie', icon: Users }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <Header onOpenPremium={() => setIsPremiumOpen(true)} />

      {/* Desktop & Tablet Navigation Bar */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4 hidden md:block">
        <nav className="flex items-center gap-1 p-1.5 rounded-2xl glass-panel border border-white/10 w-fit">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
            onNavigateTab={tab => setActiveTab(tab)}
            onOpenVoice={() => {
              // Trigger click on voice assistant FAB or open
              const fab = document.querySelector('[aria-label="KI Sprachassistent öffnen"]') as HTMLButtonElement;
              if (fab) fab.click();
            }}
            onOpenPremium={() => setIsPremiumOpen(true)}
          />
        )}

        {activeTab === 'shopping' && <ShoppingList />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'feed' && <FamilyFeed />}
        {activeTab === 'members' && <MemberManager />}
      </main>

      {/* Floating AI Voice Assistant */}
      <VoiceAssistant
        onActionCompleted={() => {
          // Trigger refresh
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
                onClick={() => setActiveTab(tab.id)}
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
