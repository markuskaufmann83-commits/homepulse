'use client';

import React, { useState, useEffect } from 'react';
import { CalendarEvent, FamilyMember } from '../lib/types';
import { Api } from '../lib/api';
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
  X
} from 'lucide-react';

const CATEGORIES = ['Familie', 'Schule', 'Arbeit', 'Freizeit', 'Arzt', 'Sonstiges'] as const;

export const CalendarView: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [viewMode, setViewMode] = useState<'agenda' | 'month'>('agenda');
  const [filterMember, setFilterMember] = useState<string>('all');

  // Month navigation
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Add Event Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('14:00');
  const [newEndTime, setNewEndTime] = useState('15:00');
  const [newLocation, setNewLocation] = useState('');
  const [newCategory, setNewCategory] = useState<typeof CATEGORIES[number]>('Familie');
  const [assignedMembers, setAssignedMembers] = useState<string[]>(['all']);

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
    const handleDataChange = () => loadData();
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
    await loadData();
  };

  const handleDeleteEvent = async (id: string) => {
    await Api.deleteCalendarEvent(id);
    await loadData();
  };

  // Filter events
  const filteredEvents = events.filter(e => {
    if (filterMember === 'all') return true;
    return e.assignedMemberIds.includes('all') || e.assignedMemberIds.includes(filterMember);
  });

  // Helper for member assignment details
  const getAssignedMembersInfo = (ids: string[]) => {
    if (ids.includes('all')) {
      return { label: 'Alle', color: '#10B981', avatar: '👨‍👩‍👧‍👦' };
    }
    const mems = members.filter(m => ids.includes(m.id));
    if (mems.length === 1) {
      return { label: mems[0].name, color: mems[0].color, avatar: mems[0].avatar };
    }
    return { label: `${mems.length} Personen`, color: '#6366F1', avatar: '👥' };
  };

  // Date formatting helpers
  const formatEventDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    const formatted = date.toLocaleDateString('de-DE', options);

    if (isToday) return `Heute • ${formatted}`;
    if (isTomorrow) return `Morgen • ${formatted}`;
    return formatted;
  };

  // Group events by date for Agenda view
  const eventsByDate = filteredEvents.reduce((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  // Month grid helpers
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return (day + 6) % 7; // Monday = 0
  };

  const renderMonthView = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const totalDays = daysInMonth(year, month);
    const startingDay = firstDayOfMonth(year, month);

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
              onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Heute
            </button>
            <button
              onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
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
            <div key={`blank-${i}`} className="min-h-[70px] rounded-xl bg-slate-900/30 border border-white/5 opacity-30"></div>
          ))}
          {days.map(d => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayEvents = filteredEvents.filter(e => e.date === dateStr);
            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            return (
              <div
                key={`day-${d}`}
                className={`min-h-[75px] p-1.5 rounded-xl border flex flex-col justify-between transition-all ${
                  isToday
                    ? 'bg-emerald-500/15 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-900/60 border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-emerald-500 text-white' : 'text-slate-300'
                    }`}
                  >
                    {d}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-medium">{dayEvents.length}</span>
                  )}
                </div>

                <div className="space-y-1 mt-1 overflow-hidden">
                  {dayEvents.slice(0, 2).map(ev => {
                    const info = getAssignedMembersInfo(ev.assignedMemberIds);
                    return (
                      <div
                        key={ev.id}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* View Mode Toggle */}
            <div className="flex p-1 rounded-xl bg-slate-900 border border-white/10">
              <button
                onClick={() => setViewMode('agenda')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'agenda' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Liste</span>
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Monat</span>
              </button>
            </div>

            {/* New Event Button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
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
      {viewMode === 'month' ? (
        <div className="glass-panel rounded-3xl p-6">{renderMonthView()}</div>
      ) : (
        /* Agenda View */
        <div className="space-y-6">
          {Object.keys(eventsByDate).length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                <CalendarIcon className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-white">Keine anstehenden Termine</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Für den gewählten Filter liegen aktuell keine Einträge vor. Erstelle einen Termin oder nutze den Sprachassistenten!
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
                                <h4 className="text-sm font-semibold text-white">{ev.title}</h4>
                              </div>
                              {ev.description && (
                                <p className="text-xs text-slate-300 line-clamp-2">{ev.description}</p>
                              )}
                            </div>

                            <button
                              onClick={() => handleDeleteEvent(ev.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                              title="Termin löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Uhrzeit</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Ende (optional)</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={e => setNewEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Kategorie</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
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
    </div>
  );
};
