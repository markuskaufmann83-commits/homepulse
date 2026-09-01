'use client';

import React, { useState, useEffect } from 'react';
import { CalendarEvent, FamilyMember } from '../lib/types';
import { Api } from '../lib/api';
import { GoogleCalendarService } from '../lib/googleCalendar';
import { downloadIcsFile } from '../lib/ical';
import { formatLocalDate, parseLocalDate, getWeekDays, getTodayDateStr } from '../lib/dateUtils';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  Trash2,
  List,
  Grid,
  Sparkles,
  Edit2,
  RefreshCw,
  Download,
  Upload,
  ExternalLink,
  Check,
  CalendarDays,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';

const CATEGORIES = ['Familie', 'Schule', 'Arbeit', 'Freizeit', 'Arzt', 'Sonstiges'] as const;

interface CalendarViewProps {
  onOpenVoice?: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onOpenVoice }) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [viewMode, setViewMode] = useState<'agenda' | 'week' | 'month'>('agenda');
  const [filterMember, setFilterMember] = useState<string>('all');

  // Navigation dates
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Add Event Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(getTodayDateStr());
  const [newTime, setNewTime] = useState('14:00');
  const [newEndTime, setNewEndTime] = useState('15:00');
  const [newLocation, setNewLocation] = useState('');
  const [newCategory, setNewCategory] = useState<typeof CATEGORIES[number]>('Familie');
  const [assignedMembers, setAssignedMembers] = useState<string[]>(['all']);

  // Edit Event Modal
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Google Sync Modal
  const [isGoogleSyncOpen, setIsGoogleSyncOpen] = useState(false);
  const [gcalUrl, setGcalUrl] = useState('');
  const [selectedSyncMember, setSelectedSyncMember] = useState<string>('mem_2'); // Default Papa
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const loadData = async () => {
    const [fetchedEvents, fetchedMembers] = await Promise.all([
      Api.getCalendarEvents(),
      Api.getMembers()
    ]);
    setEvents(fetchedEvents);
    setMembers(fetchedMembers);
  };

  useEffect(() => {
    loadData();
    const handleDataChange = (e: any) => {
      const res = e?.detail?.resource;
      if (!res || res === 'calendar' || res === 'members' || res === 'all') {
        loadData();
      }
    };
    window.addEventListener('homepulse-data-change', handleDataChange);
    return () => window.removeEventListener('homepulse-data-change', handleDataChange);
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;

    await Api.addCalendarEvent({
      title: newTitle.trim(),
      date: newDate,
      time: newTime || undefined,
      endTime: newEndTime || undefined,
      location: newLocation.trim() || undefined,
      category: newCategory,
      assignedMemberIds: assignedMembers.length > 0 ? assignedMembers : ['all']
    });

    setIsAddModalOpen(false);
    setNewTitle('');
    setNewLocation('');
    try {
      confetti({ particleCount: 30, spread: 45, origin: { y: 0.8 } });
    } catch {}
    await loadData();
  };

  const handleSaveEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    await Api.updateCalendarEvent(editingEvent);
    setEditingEvent(null);
    await loadData();
  };

  const handleDeleteEvent = async (id: string) => {
    await Api.deleteCalendarEvent(id);
    await loadData();
  };

  // Google Calendar Sync Execution
  const handleExecuteGoogleSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);

    const result = await GoogleCalendarService.syncFromUrl(gcalUrl, selectedSyncMember);
    if (result.success) {
      setSyncStatusMsg({ text: result.message, isError: false });
      try {
        confetti({ particleCount: 35, spread: 45, origin: { y: 0.7 } });
      } catch {}
      await loadData();
    } else {
      setSyncStatusMsg({ text: result.message, isError: true });
    }
    setIsSyncing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const content = event.target?.result as string;
      if (content) {
        const res = GoogleCalendarService.importFromIcsText(content, selectedSyncMember);
        if (res.success) {
          setSyncStatusMsg({ text: res.message, isError: false });
          await loadData();
        } else {
          setSyncStatusMsg({ text: res.message, isError: true });
        }
      }
    };
    reader.readAsText(file);
  };

  const handleExportIcs = () => {
    downloadIcsFile(events, 'homepulse-familienkalender.ics');
  };

  // Filter events
  const filteredEvents = events.filter(e => {
    if (filterMember === 'all') return true;
    return e.assignedMemberIds.includes('all') || e.assignedMemberIds.includes(filterMember);
  });

  const getAssignedMembersInfo = (ids: string[]) => {
    if (!ids || ids.length === 0 || ids.includes('all')) {
      return { label: 'Alle', color: '#10B981', avatar: '👨‍👩‍👧‍👦' };
    }
    const mems = members.filter(m => ids.includes(m.id));
    if (mems.length === 1) {
      return { label: mems[0].name, color: mems[0].color, avatar: mems[0].avatar };
    }
    if (mems.length > 1) {
      return { label: `${mems.length} Personen`, color: '#6366F1', avatar: '👥' };
    }
    return { label: 'Familie', color: '#3B82F6', avatar: '👤' };
  };

  // Helper date formatters
  const formatEventDateHeader = (dateStr: string) => {
    const dateObj = parseLocalDate(dateStr);
    const todayStr = getTodayDateStr();

    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = formatLocalDate(tomorrowObj);

    const formatted = dateObj.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    if (dateStr === todayStr) return `Heute • ${formatted}`;
    if (dateStr === tomorrowStr) return `Morgen • ${formatted}`;
    return formatted;
  };

  // Group events by date for Agenda view
  const eventsByDate = filteredEvents.reduce((acc, ev) => {
    const cleanDate = (ev.date || '').split('T')[0];
    if (!cleanDate) return acc;
    if (!acc[cleanDate]) acc[cleanDate] = [];
    acc[cleanDate].push(ev);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  // Month grid helpers
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return (day + 6) % 7; // Monday = 0
  };

  // Week View
  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const todayStr = getTodayDateStr();

    return (
      <div className="space-y-4">
        {/* Week Header Navigation */}
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm sm:text-base font-bold text-white">
            Woche vom {weekDays[0].toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} bis{' '}
            {weekDays[6].toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() - 7);
                setCurrentDate(d);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Vorherige Woche"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Diese Woche
            </button>
            <button
              onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() + 7);
                setCurrentDate(d);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Nächste Woche"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 7 Columns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dateStr = formatLocalDate(day);
            const isToday = dateStr === todayStr;
            const dayEvents = filteredEvents.filter(e => (e.date || '').split('T')[0] === dateStr);

            return (
              <div
                key={dateStr}
                className={`p-3 rounded-2xl border flex flex-col justify-between min-h-[180px] transition-all ${
                  isToday
                    ? 'bg-blue-950/40 border-blue-500/50 shadow-md shadow-blue-900/20 ring-1 ring-blue-500/30'
                    : 'bg-slate-900/60 border-white/5 hover:border-white/15'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2">
                    <span className="text-[11px] font-semibold text-slate-400">
                      {day.toLocaleDateString('de-DE', { weekday: 'short' })}
                    </span>
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-200'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {dayEvents.length === 0 ? (
                      <span className="text-[10px] text-slate-500 block text-center py-4">Keine Termine</span>
                    ) : (
                      dayEvents.map(ev => {
                        const info = getAssignedMembersInfo(ev.assignedMemberIds);
                        return (
                          <div
                            key={ev.id}
                            onClick={() => setEditingEvent(ev)}
                            className="p-2 rounded-xl border text-[11px] font-medium text-white cursor-pointer hover:scale-[1.02] transition-transform space-y-0.5"
                            style={{
                              backgroundColor: `${info.color}25`,
                              borderColor: `${info.color}66`
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-300">{ev.time || 'Ganztägig'}</span>
                              {ev.isGoogleSynced && (
                                <span className="text-[9px] px-1 rounded bg-blue-500/30 text-blue-200">G</span>
                              )}
                            </div>
                            <p className="truncate font-semibold text-white leading-tight">{ev.title}</p>
                            {ev.location && (
                              <p className="text-[9px] text-slate-300 truncate flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5 text-rose-400" />
                                <span className="truncate">{ev.location}</span>
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setNewDate(dateStr);
                    setIsAddModalOpen(true);
                  }}
                  className="mt-2 w-full py-1.5 rounded-lg text-[10px] text-slate-400 hover:text-white hover:bg-white/5 border border-dashed border-white/10 flex items-center justify-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Termin</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Month View
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startingDay = firstDayOfMonth(year, month);
    const todayStr = getTodayDateStr();

    const monthNames = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

    const blanks = Array.from({ length: startingDay }, (_, i) => i);
    const days = Array.from({ length: totalDays }, (_, i) => i + 1);

    return (
      <div className="space-y-4">
        {/* Month Header Navigation */}
        <div className="flex items-center justify-between px-2">
          <h3 className="text-base font-bold text-white">
            {monthNames[month]} {year}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Vorheriger Monat"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Heute
            </button>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Nächster Monat"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* Grid Cells */}
        <div className="grid grid-cols-7 gap-1.5">
          {blanks.map(i => (
            <div key={`blank-${i}`} className="min-h-[75px] rounded-xl bg-slate-900/30 border border-white/5 opacity-30"></div>
          ))}
          {days.map(d => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayEvents = filteredEvents.filter(e => (e.date || '').split('T')[0] === dateStr);
            const isToday = dateStr === todayStr;

            return (
              <div
                key={`day-${d}`}
                onClick={() => {
                  setNewDate(dateStr);
                  setIsAddModalOpen(true);
                }}
                className={`min-h-[85px] p-1.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                  isToday
                    ? 'bg-blue-500/15 border-blue-500/40 shadow-sm ring-1 ring-blue-500/30'
                    : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-blue-500 text-white' : 'text-slate-300'
                    }`}
                  >
                    {d}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-medium px-1 rounded bg-white/5">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1 mt-1 overflow-hidden">
                  {dayEvents.slice(0, 2).map(ev => {
                    const info = getAssignedMembersInfo(ev.assignedMemberIds);
                    return (
                      <div
                        key={ev.id}
                        onClick={e => {
                          e.stopPropagation();
                          setEditingEvent(ev);
                        }}
                        className="text-[10px] px-1 py-0.5 rounded truncate font-medium text-white flex items-center gap-1"
                        style={{ backgroundColor: `${info.color}33`, borderColor: `${info.color}66`, borderWidth: 1 }}
                        title={`${ev.time || ''} ${ev.title}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: info.color }}></span>
                        <span className="truncate">{ev.title}</span>
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <span className="text-[9px] text-slate-400 block truncate">+{dayEvents.length - 2} weitere</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Familienkalender</h2>
              <p className="text-xs text-slate-400">
                {filteredEvents.length} anstehende Termine • Farbcodiert nach Familienmitglied
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* View Mode Toggle */}
            <div className="flex p-1 rounded-xl bg-slate-900 border border-white/10">
              <button
                onClick={() => setViewMode('agenda')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'agenda' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Liste</span>
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'week' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Woche</span>
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Monat</span>
              </button>
            </div>

            {/* Google Calendar Sync Button */}
            <button
              onClick={() => setIsGoogleSyncOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-white/10 transition-colors shadow-sm"
              title="Google Kalender synchronisieren"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
              <span>Google Sync</span>
            </button>

            {/* New Event Button */}
            <button
              onClick={() => {
                setNewDate(getTodayDateStr());
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Termin eintragen</span>
            </button>
          </div>
        </div>

        {/* Member Filter Bar */}
        <div className="mt-5 pt-5 border-t border-white/10 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 mr-1">Filter nach:</span>
          <button
            onClick={() => setFilterMember('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
              filterMember === 'all'
                ? 'bg-white/15 text-white border-white/30 font-semibold'
                : 'bg-slate-900/50 text-slate-400 border-white/5 hover:border-white/20'
            }`}
          >
            Alle Mitglieder
          </button>
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => setFilterMember(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                filterMember === m.id
                  ? 'text-white font-semibold'
                  : 'text-slate-400 bg-slate-900/50 border-white/5 hover:border-white/20'
              }`}
              style={{
                backgroundColor: filterMember === m.id ? `${m.color}33` : undefined,
                borderColor: filterMember === m.id ? m.color : undefined
              }}
            >
              <span>{m.avatar}</span>
              <span>{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Calendar Content */}
      {viewMode === 'month' && (
        <div className="glass-panel rounded-3xl p-6">{renderMonthView()}</div>
      )}

      {viewMode === 'week' && (
        <div className="glass-panel rounded-3xl p-6">{renderWeekView()}</div>
      )}

      {viewMode === 'agenda' && (
        /* Agenda View */
        <div className="space-y-6">
          {Object.keys(eventsByDate).length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                <CalendarIcon className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-white">Keine anstehenden Termine</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Für den gewählten Filter liegen aktuell keine Einträge vor. Erstelle einen Termin, synchronisiere Google Kalender oder nutze den Sprachassistenten!
              </p>
            </div>
          ) : (
            Object.entries(eventsByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([dateStr, dayEvents]) => (
                <div key={dateStr} className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    {formatEventDateHeader(dateStr)}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dayEvents.map(ev => {
                      const memberInfo = getAssignedMembersInfo(ev.assignedMemberIds);
                      return (
                        <div
                          key={ev.id}
                          className="glass-panel p-4 rounded-2xl border border-white/10 hover:border-white/20 transition-all space-y-3 relative group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md text-white"
                                  style={{ backgroundColor: `${memberInfo.color}33`, borderColor: `${memberInfo.color}66`, borderWidth: 1 }}
                                >
                                  {ev.category || 'Familie'}
                                </span>
                                {ev.isGoogleSynced && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                    🗓️ Google
                                  </span>
                                )}
                                <h4 className="text-sm font-semibold text-white">{ev.title}</h4>
                              </div>
                              {ev.description && (
                                <p className="text-xs text-slate-300 line-clamp-2">{ev.description}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditingEvent(ev)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                                title="Bearbeiten"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(ev.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                title="Termin löschen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5 text-xs text-slate-400">
                            {ev.time && (
                              <div className="flex items-center gap-1 text-slate-300">
                                <Clock className="w-3.5 h-3.5 text-blue-400" />
                                <span>
                                  {ev.time} {ev.endTime ? `- ${ev.endTime}` : ''} Uhr
                                </span>
                              </div>
                            )}
                            {ev.location && (
                              <div className="flex items-center gap-1 text-slate-300 truncate max-w-[200px]">
                                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                                <span className="truncate">{ev.location}</span>
                              </div>
                            )}
                            <div
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ml-auto"
                              style={{
                                backgroundColor: `${memberInfo.color}15`,
                                borderColor: `${memberInfo.color}40`,
                                color: memberInfo.color
                              }}
                            >
                              <span>{memberInfo.avatar}</span>
                              <span>{memberInfo.label}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* Google Calendar Sync Modal */}
      {isGoogleSyncOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl glass-panel bg-slate-900/95 border border-white/15 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Google Kalender Sync</h3>
                  <p className="text-xs text-slate-400">Gmail- und Google-Kalendertermine importieren</p>
                </div>
              </div>
              <button
                onClick={() => setIsGoogleSyncOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Message */}
            {syncStatusMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  syncStatusMsg.isError
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {syncStatusMsg.isError ? <X className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                <span>{syncStatusMsg.text}</span>
              </div>
            )}

            {/* Step 1: Member Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Für welches Familienmitglied synchronisieren?
              </label>
              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedSyncMember(m.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      selectedSyncMember === m.id
                        ? 'text-white font-bold'
                        : 'bg-slate-950/50 border-white/10 text-slate-400'
                    }`}
                    style={{
                      backgroundColor: selectedSyncMember === m.id ? `${m.color}33` : undefined,
                      borderColor: selectedSyncMember === m.id ? m.color : undefined
                    }}
                  >
                    <span>{m.avatar}</span>
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Option A: Secret iCal URL */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                  Google Kalender Geheimadresse (iCal)
                </span>
                <span className="text-[10px] text-slate-400">Automatisch synchronisiert</span>
              </div>

              <input
                type="url"
                value={gcalUrl}
                onChange={e => setGcalUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500/50"
              />

              <p className="text-[11px] text-slate-400 leading-relaxed">
                👉 <strong>So findest du den Link:</strong> In Google Kalender auf das Zahnrad ⚙️ &gt; <em>Einstellungen deines Kalenders</em> &gt; ganz unten unter <em>&quot;Geheime Adresse im iCal-Format&quot;</em> kopieren.
              </p>

              <button
                onClick={handleExecuteGoogleSync}
                disabled={isSyncing}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 active:scale-95 transition-all"
              >
                {isSyncing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Jetzt mit Google synchronisieren</span>
              </button>
            </div>

            {/* Option B: ICS Import / Export */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <label className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1">
                <Upload className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-white">.ics Datei importieren</span>
                <span className="text-[10px] text-slate-400">Aus Gmail heruntergeladen</span>
                <input type="file" accept=".ics,text/calendar" onChange={handleFileUpload} className="hidden" />
              </label>

              <button
                onClick={handleExportIcs}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-center transition-colors flex flex-col items-center justify-center gap-1"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white">Kalender exportieren</span>
                <span className="text-[10px] text-slate-400">Als .ics herunterladen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl glass-panel bg-slate-900/95 border border-white/15 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Neuen Termin eintragen</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Titel / Anlass *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="z.B. Kindergeburtstag Felix"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Datum *</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Uhrzeit</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Ende (optional)</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={e => setNewEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Ort</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={e => setNewLocation(e.target.value)}
                    placeholder="z.B. Sportplatz / Praxis"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Kategorie</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c} className="bg-slate-900 text-white">{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assigned Members */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Für wen gilt der Termin?</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignedMembers(['all'])}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      assignedMembers.includes('all')
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold'
                        : 'bg-slate-950/50 border-white/10 text-slate-400'
                    }`}
                  >
                    👨‍👩‍👧‍👦 Alle
                  </button>
                  {members.map(m => {
                    const isSelected = assignedMembers.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (assignedMembers.includes('all')) {
                            setAssignedMembers([m.id]);
                          } else {
                            if (isSelected) {
                              const remaining = assignedMembers.filter(id => id !== m.id);
                              setAssignedMembers(remaining.length > 0 ? remaining : ['all']);
                            } else {
                              setAssignedMembers([...assignedMembers, m.id]);
                            }
                          }
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                          isSelected && !assignedMembers.includes('all')
                            ? 'text-white font-semibold'
                            : 'bg-slate-950/50 border-white/10 text-slate-400'
                        }`}
                        style={{
                          backgroundColor: isSelected && !assignedMembers.includes('all') ? `${m.color}33` : undefined,
                          borderColor: isSelected && !assignedMembers.includes('all') ? m.color : undefined
                        }}
                      >
                        <span>{m.avatar}</span>
                        <span>{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 active:scale-95 transition-all"
                >
                  Termin speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl glass-panel bg-slate-900/95 border border-white/15 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <Edit2 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Termin bearbeiten</h3>
              </div>
              <button
                onClick={() => setEditingEvent(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditEvent} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Titel / Anlass *</label>
                <input
                  type="text"
                  required
                  value={editingEvent.title}
                  onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Datum *</label>
                  <input
                    type="date"
                    required
                    value={editingEvent.date}
                    onChange={e => setEditingEvent({ ...editingEvent, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Uhrzeit</label>
                  <input
                    type="time"
                    value={editingEvent.time || ''}
                    onChange={e => setEditingEvent({ ...editingEvent, time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Ende</label>
                  <input
                    type="time"
                    value={editingEvent.endTime || ''}
                    onChange={e => setEditingEvent({ ...editingEvent, endTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Ort</label>
                  <input
                    type="text"
                    value={editingEvent.location || ''}
                    onChange={e => setEditingEvent({ ...editingEvent, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Kategorie</label>
                  <select
                    value={editingEvent.category || 'Familie'}
                    onChange={e => setEditingEvent({ ...editingEvent, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c} className="bg-slate-900 text-white">{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteEvent(editingEvent.id);
                    setEditingEvent(null);
                  }}
                  className="px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Löschen</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingEvent(null)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30"
                  >
                    Änderungen speichern
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
