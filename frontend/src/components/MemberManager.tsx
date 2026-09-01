'use client';

import React, { useState, useEffect } from 'react';
import { FamilyMember, MemberStatus, Household } from '../lib/types';
import { Api } from '../lib/api';
import { getAuthSession } from '../lib/storage';
import {
  Users,
  Shield,
  ShieldAlert,
  Plus,
  Edit2,
  Trash2,
  Check,
  Sparkles,
  Home,
  Navigation,
  Briefcase,
  GraduationCap,
  Palmtree,
  KeyRound,
  Copy,
  Share2,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';

const AVATAR_OPTIONS = ['👩‍💼', '👨‍💻', '👧', '👦', '👵', '👴', '🐶', '🐱', '🧑‍🎨', '👩‍🍳', '🧔', '👱‍♀️'];
const COLOR_OPTIONS = ['#EC4899', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#14B8A6', '#F43F5E', '#6366F1'];

export const MemberManager: React.FC = () => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [household, setHousehold] = useState<Household | null>(null);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // New member form
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member' | 'child'>('member');
  const [newAvatar, setNewAvatar] = useState('👩‍💼');
  const [newColor, setNewColor] = useState('#3B82F6');

  const loadData = async () => {
    const session = getAuthSession();
    if (session) {
      setHousehold(session.household);
    }
    const mems = await Api.getMembers();
    setMembers(mems);
  };

  useEffect(() => {
    loadData();
    const handleDataChange = () => loadData();
    window.addEventListener('homepulse-data-change', handleDataChange);
    return () => window.removeEventListener('homepulse-data-change', handleDataChange);
  }, []);

  const handleUpdateStatus = async (member: FamilyMember, status: MemberStatus) => {
    const updated = {
      ...member,
      status,
      updatedAt: new Date().toISOString()
    };
    await Api.updateMember(updated);
    await loadData();
  };

  const handleTogglePrivacy = async (member: FamilyMember) => {
    const updated = {
      ...member,
      locationShared: !member.locationShared,
      updatedAt: new Date().toISOString()
    };
    await Api.updateMember(updated);
    await loadData();
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    await Api.updateMember(editingMember);
    setEditingMember(null);
    await loadData();
  };

  const handleDeleteMember = async (id: string) => {
    if (members.length <= 1) {
      alert('Mindestens ein Haushaltsmitglied muss bestehen bleiben.');
      return;
    }
    if (confirm('Möchtest du dieses Mitglied wirklich aus dem Haushalt entfernen?')) {
      await Api.deleteMember(id);
      setEditingMember(null);
      await loadData();
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    await Api.addMember({
      name: newName.trim(),
      role: newRole,
      avatar: newAvatar,
      color: newColor,
      status: 'home',
      locationShared: true
    });

    setIsAddModalOpen(false);
    setNewName('');
    try {
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
    } catch {}
    await loadData();
  };

  const handleCopyCode = () => {
    if (household?.inviteCode) {
      navigator.clipboard.writeText(household.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const getStatusInfo = (status: MemberStatus) => {
    switch (status) {
      case 'home':
        return { label: 'Zuhause', icon: <Home className="w-3.5 h-3.5" />, color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' };
      case 'away':
        return { label: 'Unterwegs', icon: <Navigation className="w-3.5 h-3.5" />, color: 'text-amber-400 bg-amber-500/20 border-amber-500/30' };
      case 'work':
        return { label: 'Arbeit / Büro', icon: <Briefcase className="w-3.5 h-3.5" />, color: 'text-blue-400 bg-blue-500/20 border-blue-500/30' };
      case 'school':
        return { label: 'Schule / Uni', icon: <GraduationCap className="w-3.5 h-3.5" />, color: 'text-purple-400 bg-purple-500/20 border-purple-500/30' };
      case 'vacation':
        return { label: 'Im Urlaub', icon: <Palmtree className="w-3.5 h-3.5" />, color: 'text-rose-400 bg-rose-500/20 border-rose-500/30' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Familienmitglieder</h2>
              <p className="text-xs text-slate-400">
                {members.length} {members.length === 1 ? 'Mitglied' : 'Mitglieder'} in {household?.name || 'deinem Haushalt'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 active:scale-95 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Mitglied hinzufügen</span>
          </button>
        </div>
      </div>

      {/* Household Invite Banner */}
      {household?.inviteCode && (
        <div className="glass-panel rounded-3xl p-6 border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-slate-900/80 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Familienmitglieder einladen</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Einladungscode
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                  Deine Familie (Partner, Kinder, Mitbewohner) kann sich einfach mit ihrer eigenen E-Mail-Adresse registrieren und diesen Code eingeben, um automatisch deinem Haushalt beizutreten.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
              <div className="px-4 py-2.5 rounded-2xl bg-slate-950 border border-emerald-500/40 font-mono text-base font-black tracking-widest text-emerald-300 shadow-inner">
                {household.inviteCode}
              </div>

              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 active:scale-95 transition-all"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Kopiert!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Code kopieren</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {members.map(m => {
          const statusInfo = getStatusInfo(m.status);
          return (
            <div
              key={m.id}
              className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-all space-y-4 relative overflow-hidden"
            >
              {/* Member Top Bar */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg border"
                    style={{
                      backgroundColor: `${m.color}25`,
                      borderColor: m.color
                    }}
                  >
                    <span>{m.avatar}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{m.name}</h3>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10">
                        {m.role === 'admin' ? 'Admin' : (m.role === 'child' ? 'Kind' : 'Mitglied')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {m.statusMessage || 'Kein Statuszusatz eingetragen'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setEditingMember(m)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Profil bearbeiten"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* Status Selector */}
              <div className="space-y-1.5 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400">Aktueller Status:</span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
                    {statusInfo.icon}
                    {statusInfo.label}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {[
                    { id: 'home', label: 'Zuhause', icon: '🏠' },
                    { id: 'away', label: 'Unterwegs', icon: '🚗' },
                    { id: 'work', label: 'Büro', icon: '💼' },
                    { id: 'school', label: 'Schule', icon: '📚' }
                  ].map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleUpdateStatus(m, s.id as MemberStatus)}
                      className={`px-2 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1 ${
                        m.status === s.id
                          ? 'bg-white/20 text-white font-bold border-white/40 shadow-sm'
                          : 'bg-slate-900/50 text-slate-400 border-white/5 hover:border-white/15'
                      }`}
                    >
                      <span>{s.icon}</span>
                      <span className="hidden sm:inline">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Privacy & Location Sharing Toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="flex items-center gap-2">
                  {m.locationShared ? (
                    <Shield className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                  )}
                  <div>
                    <p className="text-xs font-medium text-slate-200">
                      {m.locationShared ? 'Status & Standort freigegeben' : 'Privater Modus aktiv'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {m.locationShared ? 'Sichtbar für Haushaltsmitglieder' : 'Status ist privat'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleTogglePrivacy(m)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                    m.locationShared
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {m.locationShared ? 'Aktiv' : 'Deaktiviert'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl glass-panel bg-slate-900/95 border border-white/15 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">Profil bearbeiten</h3>
              <button
                onClick={() => setEditingMember(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={editingMember.name}
                  onChange={e => setEditingMember({ ...editingMember, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Rolle</label>
                <select
                  value={editingMember.role}
                  onChange={e => setEditingMember({ ...editingMember, role: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                >
                  <option value="admin" className="bg-slate-900">Admin (Eltern)</option>
                  <option value="member" className="bg-slate-900">Mitglied</option>
                  <option value="child" className="bg-slate-900">Kind</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Statusnachricht</label>
                <input
                  type="text"
                  value={editingMember.statusMessage || ''}
                  onChange={e => setEditingMember({ ...editingMember, statusMessage: e.target.value })}
                  placeholder="z.B. Zuhause im Homeoffice"
                  className="w-full px-4 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Avatar Emoji</label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditingMember({ ...editingMember, avatar: emoji })}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border transition-all ${
                        editingMember.avatar === emoji
                          ? 'bg-white/20 border-indigo-400 scale-110 shadow'
                          : 'bg-slate-950/50 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Profilfarbe</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setEditingMember({ ...editingMember, color: col })}
                      className={`w-7 h-7 rounded-full border transition-all ${
                        editingMember.color === col ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => handleDeleteMember(editingMember.id)}
                  className="px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Mitglied löschen</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl glass-panel bg-slate-900/95 border border-white/15 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">Neues Familienmitglied</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="z.B. Oma Gertrud oder Leon"
                  className="w-full px-4 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Rolle</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                >
                  <option value="admin" className="bg-slate-900">Admin (Eltern)</option>
                  <option value="member" className="bg-slate-900">Mitglied</option>
                  <option value="child" className="bg-slate-900">Kind</option>
                </select>
              </div>

              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Avatar Emoji</label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewAvatar(emoji)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border transition-all ${
                        newAvatar === emoji
                          ? 'bg-white/20 border-indigo-400 scale-110'
                          : 'bg-slate-950/50 border-white/10'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Farbe</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewColor(col)}
                      className={`w-7 h-7 rounded-full border transition-all ${
                        newColor === col ? 'ring-2 ring-white scale-110' : 'opacity-70'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
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
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30"
                >
                  Hinzufügen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
