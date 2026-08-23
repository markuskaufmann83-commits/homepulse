'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingItem, ShoppingCategory, FamilyMember } from '../lib/types';
import { Api } from '../lib/api';
import { getCurrentUser } from '../lib/storage';
import {
  ShoppingCart,
  Plus,
  Check,
  Trash2,
  Filter,
  User,
  Sparkles,
  PackageCheck,
  Tag
} from 'lucide-react';
import confetti from 'canvas-confetti';

const CATEGORIES: ShoppingCategory[] = [
  'Frische',
  'Vorrat',
  'Obst & Gemüse',
  'Drogerie',
  'Getränke',
  'Tiefkühl',
  'Sonstiges'
];

export const ShoppingList: React.FC = () => {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [currentUser, setCurrentUser] = useState<FamilyMember | null>(null);

  // New item form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<ShoppingCategory>('Frische');
  const [newQuantity, setNewQuantity] = useState<string>('1');
  const [newUnit, setNewUnit] = useState<string>('');
  const [assignedMemberId, setAssignedMemberId] = useState<string>('');

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);

  const loadData = async () => {
    const [fetchedItems, fetchedMembers] = await Promise.all([
      Api.getShoppingItems(),
      Api.getMembers()
    ]);
    setItems(fetchedItems);
    setMembers(fetchedMembers);
    const curr = getCurrentUser();
    setCurrentUser(curr);
    if (curr && !assignedMemberId) {
      setAssignedMemberId(curr.id);
    }
  };

  useEffect(() => {
    loadData();
    const handleDataChange = () => loadData();
    window.addEventListener('homepulse-data-change', handleDataChange);
    return () => window.removeEventListener('homepulse-data-change', handleDataChange);
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const qty = parseFloat(newQuantity);
    await Api.addShoppingItem({
      title: newTitle.trim(),
      category: newCategory,
      quantity: isNaN(qty) ? undefined : qty,
      unit: newUnit.trim() || undefined,
      assignedMemberId: assignedMemberId || undefined
    });

    setNewTitle('');
    setNewQuantity('1');
    setNewUnit('');
    await loadData();
  };

  const handleToggleItem = async (item: ShoppingItem) => {
    const toggled = await Api.toggleShoppingItem(item.id, currentUser?.name);
    if (toggled?.completed) {
      try {
        confetti({
          particleCount: 25,
          spread: 40,
          origin: { y: 0.9 }
        });
      } catch {}
    }
    await loadData();
  };

  const handleDeleteItem = async (id: string) => {
    await Api.deleteShoppingItem(id);
    await loadData();
  };

  const handleClearCompleted = async () => {
    const completedItems = items.filter(i => i.completed);
    for (const item of completedItems) {
      await Api.deleteShoppingItem(item.id);
    }
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch {}
    await loadData();
  };

  // Filtered items
  const filteredItems = items.filter(item => {
    if (hideCompleted && item.completed) return false;
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (filterMember !== 'all' && item.assignedMemberId !== filterMember) return false;
    return true;
  });

  // Group by category
  const groupedItems = CATEGORIES.reduce((acc, cat) => {
    const catItems = filteredItems.filter(i => i.category === cat);
    if (catItems.length > 0) {
      acc[cat] = catItems;
    }
    return acc;
  }, {} as Record<ShoppingCategory, ShoppingItem[]>);

  const getMemberById = (id?: string) => members.find(m => m.id === id);

  const openCount = items.filter(i => !i.completed).length;
  const completedCount = items.filter(i => i.completed).length;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Gemeinsame Einkaufsliste</h2>
                <p className="text-xs text-slate-400">
                  {openCount} offen{openCount === 1 ? 'er' : 'e'} Artikel • {completedCount} erledigt
                </p>
              </div>
            </div>
          </div>

          {completedCount > 0 && (
            <button
              onClick={handleClearCompleted}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-white/10 transition-colors self-start sm:self-auto"
            >
              <PackageCheck className="w-4 h-4 text-emerald-400" />
              <span>Erledigte aufräumen ({completedCount})</span>
            </button>
          )}
        </div>

        {/* Quick Add Form */}
        <form onSubmit={handleAddItem} className="mt-6 pt-6 border-t border-white/10">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Title */}
            <div className="sm:col-span-5">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Was muss besorgt werden? (z.B. Bio-Milch)"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            {/* Quantity & Unit */}
            <div className="sm:col-span-2 flex gap-1.5">
              <input
                type="number"
                min="0.1"
                step="any"
                value={newQuantity}
                onChange={e => setNewQuantity(e.target.value)}
                placeholder="Menge"
                className="w-16 px-2.5 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm text-center focus:outline-none focus:border-emerald-500/50"
              />
              <input
                type="text"
                value={newUnit}
                onChange={e => setNewUnit(e.target.value)}
                placeholder="Einheit"
                className="flex-1 px-2.5 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Category Picker */}
            <div className="sm:col-span-2">
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value as ShoppingCategory)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500/50"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c} className="bg-slate-900 text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned Member */}
            <div className="sm:col-span-2">
              <select
                value={assignedMemberId}
                onChange={e => setAssignedMemberId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500/50"
              >
                <option value="" className="bg-slate-900 text-white">Zuweisen an...</option>
                {members.map(m => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                    {m.avatar} {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit Button */}
            <div className="sm:col-span-1">
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="w-full h-full min-h-[40px] flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-md active:scale-95"
                title="Hinzufügen"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        {/* Category & Member filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-400 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          {/* Category Chips */}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-white/10 text-slate-200 text-xs focus:outline-none"
          >
            <option value="all">Alle Kategorien</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Member Filter */}
          <select
            value={filterMember}
            onChange={e => setFilterMember(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-white/10 text-slate-200 text-xs focus:outline-none"
          >
            <option value="all">Alle Zuständigen</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.avatar} {m.name}</option>
            ))}
          </select>
        </div>

        {/* Hide completed toggle */}
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={e => setHideCompleted(e.target.checked)}
            className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
          />
          <span>Erledigte ausblenden</span>
        </label>
      </div>

      {/* Categorized List */}
      {Object.keys(groupedItems).length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
            <Check className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white">Alles besorgt!</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Keine offenen Artikel in dieser Ansicht. Verwende den Sprachassistenten oder das Eingabefeld oben, um neue Dinge hinzuzufügen.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, catItems]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2 px-2">
                <Tag className="w-3.5 h-3.5 text-emerald-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {category} ({catItems.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {catItems.map(item => {
                  const assignedMember = getMemberById(item.assignedMemberId);
                  return (
                    <div
                      key={item.id}
                      className={`glass-panel p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        item.completed
                          ? 'bg-slate-900/40 border-white/5 opacity-60'
                          : 'bg-slate-900/75 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Checkbox & Title */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          onClick={() => handleToggleItem(item)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                            item.completed
                              ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/40'
                              : 'bg-slate-800 border border-white/20 hover:border-emerald-400 text-transparent'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                        </button>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium leading-tight truncate ${
                              item.completed ? 'line-through text-slate-400' : 'text-slate-100'
                            }`}
                          >
                            {item.quantity && item.quantity > 1 ? `${item.quantity} ` : ''}
                            {item.unit ? `${item.unit} ` : ''}
                            {item.title}
                          </p>

                          {item.completed && item.completedBy && (
                            <p className="text-[10px] text-emerald-400 mt-0.5">
                              Abgehakt von {item.completedBy}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Assigned Member & Delete */}
                      <div className="flex items-center gap-2 shrink-0">
                        {assignedMember && (
                          <div
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
                            style={{
                              backgroundColor: `${assignedMember.color}15`,
                              borderColor: `${assignedMember.color}40`,
                              color: assignedMember.color
                            }}
                          >
                            <span>{assignedMember.avatar}</span>
                            <span className="hidden sm:inline">{assignedMember.name}</span>
                          </div>
                        )}

                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
