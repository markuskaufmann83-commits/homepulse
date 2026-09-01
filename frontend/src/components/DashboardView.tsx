'use client';

import React, { useState, useEffect } from 'react';
import { FamilyMember, ShoppingItem, CalendarEvent, FeedPost } from '../lib/types';
import { Api } from '../lib/api';
import { getCurrentUser } from '../lib/storage';
import {
  Sparkles,
  Calendar as CalendarIcon,
  ShoppingCart,
  MessageSquare,
  Users,
  Check,
  Clock,
  MapPin,
  ArrowRight,
  Pin,
  Activity,
  Plus
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenVoice: () => void;
  onOpenPremium: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenVoice,
  onOpenPremium
}) => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [currentUser, setCurrentUser] = useState<FamilyMember | null>(null);

  const loadData = async () => {
    const [mems, shops, cals, posts] = await Promise.all([
      Api.getMembers(),
      Api.getShoppingItems(),
      Api.getCalendarEvents(),
      Api.getFeedPosts()
    ]);
    setMembers(mems);
    setShoppingItems(shops);
    setCalendarEvents(cals);
    setFeedPosts(posts);
    setCurrentUser(getCurrentUser());
  };

  useEffect(() => {
    loadData();
    const handleDataChange = (e: any) => {
      const res = e?.detail?.resource;
      if (!res || res !== 'internal') {
        loadData();
      }
    };
    window.addEventListener('homepulse-data-change', handleDataChange);
    return () => window.removeEventListener('homepulse-data-change', handleDataChange);
  }, []);

  const handleToggleShopping = async (item: ShoppingItem) => {
    const res = await Api.toggleShoppingItem(item.id, currentUser?.name);
    if (res?.completed) {
      try {
        confetti({ particleCount: 20, spread: 35, origin: { y: 0.8 } });
      } catch {}
    }
    await loadData();
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingEvents = calendarEvents.slice(0, 3);
  const openShopping = shoppingItems.filter(i => !i.completed).slice(0, 4);
  const pinnedPost = feedPosts.find(p => p.pinned) || feedPosts[0];

  const homeMembers = members.filter(m => m.status === 'home');
  const awayMembers = members.filter(m => m.status !== 'home');

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Guten Morgen';
    if (hour < 18) return 'Guten Tag';
    return 'Guten Abend';
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  return (
    <div className="space-y-6">
      {/* Hero Welcome Card */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-emerald-950/40 border border-white/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {formatDate()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {greeting()}{currentUser ? `, ${currentUser.name}` : ''}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Hier ist dein Familien-Dashboard auf einen Blick. {openShopping.length} offene Einkäufe und{' '}
              {upcomingEvents.length} anstehende Termine.
            </p>
          </div>

          {/* Quick Voice Launch Banner */}
          <div className="shrink-0">
            <button
              onClick={onOpenVoice}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 active:scale-95 transition-all"
            >
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span>Sprachbefehl sprechen</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Family Presence Bar */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Familien-Status ({homeMembers.length} Zuhause • {awayMembers.length} Unterwegs)
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('members')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
          >
            <span>Verwalten</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {members.map(m => (
            <div
              key={m.id}
              onClick={() => onNavigateTab('members')}
              className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/20 cursor-pointer transition-all flex items-center gap-3"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border"
                style={{ backgroundColor: `${m.color}25`, borderColor: m.color }}
              >
                <span>{m.avatar}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{m.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      m.status === 'home'
                        ? 'bg-emerald-400'
                        : m.status === 'work'
                        ? 'bg-blue-400'
                        : m.status === 'school'
                        ? 'bg-purple-400'
                        : m.status === 'vacation'
                        ? 'bg-orange-400'
                        : 'bg-amber-400'
                    }`}
                  ></span>
                  <span className="text-[10px] text-slate-300 truncate">
                    {m.statusMessage || (
                      m.status === 'home'
                        ? 'Zuhause'
                        : m.status === 'work'
                        ? 'Im Büro'
                        : m.status === 'school'
                        ? 'In der Schule'
                        : m.status === 'vacation'
                        ? 'Im Urlaub'
                        : 'Unterwegs'
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: Calendar, Shopping, Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Calendar Events */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Nächste Termine</h3>
                  <p className="text-[11px] text-slate-400">Aus dem Familienkalender</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('calendar')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                Alle ({calendarEvents.length})
              </button>
            </div>

            <div className="space-y-2.5">
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Keine anstehenden Termine.</p>
              ) : (
                upcomingEvents.map(ev => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/15 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {ev.date}
                      </span>
                      {ev.time && (
                        <span className="text-[11px] text-slate-300 font-medium">{ev.time} Uhr</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-white truncate">{ev.title}</p>
                    {ev.location && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-rose-400" />
                        <span className="truncate">{ev.location}</span>
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('calendar')}
            className="w-full py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Kalender öffnen</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Open Shopping Items */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Einkaufsliste</h3>
                  <p className="text-[11px] text-slate-400">
                    {openShopping.length} offene Artikel
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('shopping')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Zur Liste
              </button>
            </div>

            <div className="space-y-2">
              {openShopping.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Alles eingekauft!</p>
              ) : (
                openShopping.map(item => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleShopping(item)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0 ${
                          item.completed
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'bg-slate-800 border border-white/20 hover:border-emerald-400 text-transparent hover:text-emerald-400'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {item.quantity && item.quantity > 1 ? `${item.quantity} ` : ''}
                        {item.title}
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-white/5 shrink-0">
                      {item.category}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('shopping')}
            className="w-full py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Einkaufsliste öffnen</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Pinned Family Notice */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Familien-Pinnwand</h3>
                  <p className="text-[11px] text-slate-400">Aktuelle Mitteilungen</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('feed')}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium"
              >
                Pinnwand
              </button>
            </div>

            {pinnedPost ? (
              <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <Pin className="w-3 h-3" />
                    Wichtig / Mahlzeit
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(pinnedPost.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {pinnedPost.content}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">Keine aktuellen Mitteilungen.</p>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('feed')}
            className="w-full py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Zur Pinnwand</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
