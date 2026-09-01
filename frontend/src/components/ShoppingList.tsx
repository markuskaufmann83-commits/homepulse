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
  Search,
  Sparkles,
  PackageCheck,
  Tag,
  Edit2,
  Minus,
  CheckCheck,
  X
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

const QUICK_SUGGESTIONS: { title: string; category: ShoppingCategory; unit?: string }[] = [
  { title: 'Bio-Milch', category: 'Frische', unit: 'L' },
  { title: 'Bio-Eier', category: 'Frische', unit: 'Stk' },
  { title: 'Vollkornbrot', category: 'Vorrat', unit: 'Laib' },
  { title: 'Butter', category: 'Frische', unit: 'Pck' },
  { title: 'Äpfel', category: 'Obst & Gemüse', unit: 'kg' },
  { title: 'Bananen', category: 'Obst & Gemüse', unit: 'kg' },
  { title: 'Käse', category: 'Frische', unit: 'Pck' },
  { title: 'Kaffee', category: 'Vorrat', unit: 'Pck' },
  { title: 'Mineralwasser', category: 'Getränke', unit: 'Kasten' }
];

interface ShoppingListProps {
  onOpenVoice?: () => void;
}

export const ShoppingList: React.FC<ShoppingListProps> = ({ onOpenVoice }) => {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [currentUser, setCurrentUser] = useState<FamilyMember | null>(null);

  // New item form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<ShoppingCategory>('Frische');
  const [newQuantity, setNewQuantity] = useState<string>('1');
  const [newUnit, setNewUnit] = useState<string>('');
  const [assignedMemberId, setAssignedMemberId] = useState<string>('');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);

  // Edit Item Modal
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);

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

  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  const handleAddQuickSuggestion = async (sugg: { title: string; category: ShoppingCategory; unit?: string }) => {
    // Check if item already exists in open items
    const existing = items.find(
      i => !i.completed && i.title.toLowerCase() === sugg.title.toLowerCase()
    );

    if (existing) {
      await handleAdjustQuantity(existing, 1);
    } else {
      await Api.addShoppingItem({
        title: sugg.title,
        category: sugg.category,
        quantity: 1,
        unit: sugg.unit,
        assignedMemberId: currentUser?.id
      });
    }

    try {
      confetti({ particleCount: 15, spread: 35, origin: { y: 0.85 } });
    } catch {}

    await loadData();
  };

  const handleToggleItem = async (item: ShoppingItem) => {
    const toggled = await Api.toggleShoppingItem(item.id, currentUser?.name);
    if (toggled?.completed) {
      try {
        confetti({
          particleCount: 25,
          spread: 40,
          origin: { y: 0.85 }
        });
      } catch {}
    }
    await loadData();
  };

  const handleAdjustQuantity = async (item: ShoppingItem, delta: number) => {
    const currentQty = item.quantity || 1;
    const newQty = Math.max(1, currentQty + delta);
    const updated = { ...item, quantity: newQty };
    await Api.updateShoppingItem(updated);
    await loadData();
  };

  const handleDeleteItem = async (id: string) => {
    await Api.deleteShoppingItem(id);
    await loadData();
  };

  const handleClearCompleted = async () => {
    await Api.clearCompletedShoppingItems();
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch {}
    await loadData();
  };

  const handleCheckAllOpen = async () => {
    const openItems = items.filter(i => !i.completed);
    for (const item of openItems) {
      await Api.toggleShoppingItem(item.id, currentUser?.name);
    }
    try {
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {}
    await loadData();
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    await Api.updateShoppingItem(editingItem);
    setEditingItem(null);
    await loadData();
  };

  // Filtered items
  const filteredItems = items.filter(item => {
    if (hideCompleted && item.completed) return false;
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (filterMember !== 'all' && item.assignedMemberId !== filterMember) return false;
    if (searchQuery.trim() && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
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

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {openCount > 0 && (
              <button
                onClick={handleCheckAllOpen}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-medium border border-emerald-500/30 transition-colors"
                title="Alle offenen als erledigt markieren"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span>Alle abhaken</span>
              </button>
            )}

            {completedCount > 0 && (
              <button
                onClick={handleClearCompleted}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-white/10 transition-colors"
              >
                <PackageCheck className="w-4 h-4 text-emerald-400" />
                <span>Erledigte aufräumen ({completedCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Schnell hinzufügen:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_SUGGESTIONS.map((sugg, idx) => (
              <button
                key={idx}
                onClick={() => handleAddQuickSuggestion(sugg)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 text-xs border border-white/5 hover:border-emerald-500/30 transition-all active:scale-95"
              >
                <Plus className="w-3 h-3 text-emerald-400" />
                <span>{sugg.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Add Form */}
        <form onSubmit={handleAddItem} className="mt-4 pt-4 border-t border-white/10">
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

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
          {/* Live Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Liste durchsuchen..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-800/80 border border-white/10 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Category Filter */}
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
          <h3 className="text-base font-semibold text-white">Keine Artikel gefunden</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `Keine Treffer für "${searchQuery}".`
              : 'Alles besorgt! Verwende das Eingabefeld oben oder den Sprachassistenten, um neue Artikel hinzuzufügen.'}
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

                      {/* Quantity adjustment & Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* +/- Buttons */}
                        {!item.completed && (
                          <div className="flex items-center gap-0.5 bg-slate-950/60 rounded-lg p-0.5 border border-white/5">
                            <button
                              onClick={() => handleAdjustQuantity(item, -1)}
                              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                              title="Menge -1"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-[11px] font-bold text-slate-200 px-1 min-w-[16px] text-center">
                              {item.quantity || 1}
                            </span>
                            <button
                              onClick={() => handleAdjustQuantity(item, 1)}
                              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                              title="Menge +1"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Assigned Member Badge */}
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
                            <span className="hidden lg:inline">{assignedMember.name}</span>
                          </div>
                        )}

                        {/* Edit Button */}
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                          title="Bearbeiten"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl glass-panel bg-slate-900/95 border border-white/15 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">Artikel bearbeiten</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Artikelname *</label>
                <input
                  type="text"
                  required
                  value={editingItem.title}
                  onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Menge</label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={editingItem.quantity || 1}
                    onChange={e => setEditingItem({ ...editingItem, quantity: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Einheit</label>
                  <input
                    type="text"
                    value={editingItem.unit || ''}
                    onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })}
                    placeholder="z.B. kg, L, Pck"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Kategorie</label>
                  <select
                    value={editingItem.category}
                    onChange={e => setEditingItem({ ...editingItem, category: e.target.value as ShoppingCategory })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c} className="bg-slate-900 text-white">{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Zuweisen an</label>
                  <select
                    value={editingItem.assignedMemberId || ''}
                    onChange={e => setEditingItem({ ...editingItem, assignedMemberId: e.target.value || undefined })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                  >
                    <option value="" className="bg-slate-900 text-white">Niemand (Alle)</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                        {m.avatar} {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
