'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  SlidersHorizontal,
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

const QUICK_CHIPS: { title: string; category: ShoppingCategory; emoji: string }[] = [
  { title: 'Milch', category: 'Frische', emoji: '🥛' },
  { title: 'Eier', category: 'Frische', emoji: '🥚' },
  { title: 'Brot', category: 'Vorrat', emoji: '🍞' },
  { title: 'Butter', category: 'Frische', emoji: '🧈' },
  { title: 'Äpfel', category: 'Obst & Gemüse', emoji: '🍎' },
  { title: 'Bananen', category: 'Obst & Gemüse', emoji: '🍌' },
  { title: 'Käse', category: 'Frische', emoji: '🧀' },
  { title: 'Kaffee', category: 'Vorrat', emoji: '☕' },
  { title: 'Wasser', category: 'Getränke', emoji: '💧' },
  { title: 'Toilettenpapier', category: 'Drogerie', emoji: '🧻' }
];

// Smart auto-detection of quantity, unit, and category from free text
function parseQuickItemInput(raw: string): {
  title: string;
  quantity?: number;
  unit?: string;
  category: ShoppingCategory;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { title: '', category: 'Sonstiges' };

  // Match prefixes like "3x", "2kg", "500g", "1l", "4 Dosen", "2 Packungen"
  const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(x|kg|g|l|liter|flaschen?|packungen?|pck|stk|stück|dosen?)?\s+(.+)$/i);
  let quantity: number | undefined = undefined;
  let unit: string | undefined = undefined;
  let rawTitle = trimmed;

  if (match) {
    quantity = parseFloat(match[1].replace(',', '.'));
    if (match[2] && match[2].toLowerCase() !== 'x') {
      unit = match[2].toLowerCase();
    }
    rawTitle = match[3].trim();
  }

  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  let category: ShoppingCategory = 'Sonstiges';

  if (/milch|käse|butter|joghurt|quark|sahne|eier|fleisch|wurst|fisch|speck|tofu|hähnchen|hack/i.test(title)) category = 'Frische';
  else if (/apfel|äpfel|banane|salat|tomate|gurke|zwiebel|kartoffel|obst|gemüse|beeren|zitrone|avocado|möhre/i.test(title)) category = 'Obst & Gemüse';
  else if (/brot|nudeln|reis|mehl|zucker|kaffee|tee|öl|salz|gewürz|müsli|haferflocken|toast|honig|chips/i.test(title)) category = 'Vorrat';
  else if (/wasser|saft|bier|wein|cola|limonade|getränk|sprudel|spezi|mate/i.test(title)) category = 'Getränke';
  else if (/seife|shampoo|zahnpasta|toilettenpapier|waschmittel|putzmittel|duschgel|taschentücher|deo|spülmittel/i.test(title)) category = 'Drogerie';
  else if (/pizza|eis|spinat|pommes|tiefkühl|nuggets|tk|lachs/i.test(title)) category = 'Tiefkühl';

  return { title, quantity, unit, category };
}

interface ShoppingListProps {
  onOpenVoice?: () => void;
}

export const ShoppingList: React.FC<ShoppingListProps> = ({ onOpenVoice }) => {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [currentUser, setCurrentUser] = useState<FamilyMember | null>(null);

  // Quick single-input text
  const [quickInput, setQuickInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualCategory, setManualCategory] = useState<ShoppingCategory | 'auto'>('auto');
  const [assignedMemberId, setAssignedMemberId] = useState<string>('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);

  // Edit Item Modal
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const [fetchedItems, fetchedMembers] = await Promise.all([
      Api.getShoppingItems(),
      Api.getMembers()
    ]);
    setItems(fetchedItems);
    setMembers(fetchedMembers);
    const curr = getCurrentUser();
    setCurrentUser(curr);
  };

  useEffect(() => {
    loadData();
    const handleDataChange = (e: any) => {
      const res = e?.detail?.resource;
      if (!res || res === 'shopping' || res === 'members' || res === 'currentUser' || res === 'all') {
        loadData();
      }
    };
    window.addEventListener('homepulse-data-change', handleDataChange);
    return () => window.removeEventListener('homepulse-data-change', handleDataChange);
  }, []);

  // Quick Add Item
  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickInput.trim()) return;

    const parsed = parseQuickItemInput(quickInput);
    const categoryToUse = manualCategory !== 'auto' ? manualCategory : parsed.category;

    // If item already exists in open items, increment quantity
    const existing = items.find(
      i => !i.completed && i.title.toLowerCase() === parsed.title.toLowerCase()
    );

    if (existing) {
      await handleAdjustQuantity(existing, parsed.quantity || 1);
    } else {
      await Api.addShoppingItem({
        title: parsed.title,
        category: categoryToUse,
        quantity: parsed.quantity || 1,
        unit: parsed.unit,
        assignedMemberId: assignedMemberId || undefined
      });
    }

    setQuickInput('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
    await loadData();
  };

  // Quick 1-Click Chip Add
  const handleChipClick = async (chip: typeof QUICK_CHIPS[number]) => {
    const existing = items.find(
      i => !i.completed && i.title.toLowerCase() === chip.title.toLowerCase()
    );

    if (existing) {
      await handleAdjustQuantity(existing, 1);
    } else {
      await Api.addShoppingItem({
        title: chip.title,
        category: chip.category,
        quantity: 1,
        assignedMemberId: currentUser?.id
      });
    }

    try {
      confetti({ particleCount: 15, spread: 35, origin: { y: 0.85 } });
    } catch {}

    await loadData();
  };

  // Toggle Checkbox
  const handleToggleItem = async (item: ShoppingItem) => {
    const toggled = await Api.toggleShoppingItem(item.id, currentUser?.name);
    if (toggled?.completed) {
      try {
        confetti({ particleCount: 25, spread: 45, origin: { y: 0.85 } });
      } catch {}
    }
    await loadData();
  };

  // +/- Quantity
  const handleAdjustQuantity = async (item: ShoppingItem, delta: number) => {
    const currentQty = item.quantity || 1;
    const newQty = Math.max(1, currentQty + delta);
    const updated = { ...item, quantity: newQty };
    await Api.updateShoppingItem(updated);
    await loadData();
  };

  // Delete
  const handleDeleteItem = async (id: string) => {
    await Api.deleteShoppingItem(id);
    await loadData();
  };

  // Clear Completed
  const handleClearCompleted = async () => {
    await Api.clearCompletedShoppingItems();
    try {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
    } catch {}
    await loadData();
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    await Api.updateShoppingItem(editingItem);
    setEditingItem(null);
    await loadData();
  };

  // Filter items
  const filteredItems = items.filter(item => {
    if (hideCompleted && item.completed) return false;
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
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
      {/* Header & Quick Input Bar */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 relative overflow-hidden bg-slate-900/90 border border-white/10 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Einkaufsliste</h2>
              <p className="text-xs text-slate-400">
                {openCount} offene Artikel • {completedCount} erledigt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {completedCount > 0 && (
              <button
                onClick={handleClearCompleted}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-white/10 transition-colors"
                title="Erledigte von der Liste entfernen"
              >
                <PackageCheck className="w-4 h-4 text-emerald-400" />
                <span>Erledigte löschen ({completedCount})</span>
              </button>
            )}

            {onOpenVoice && (
              <button
                onClick={onOpenVoice}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold shadow-md shadow-emerald-500/25 active:scale-95 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Spracheingabe</span>
              </button>
            )}
          </div>
        </div>

        {/* 1-Field Smart Add Bar */}
        <form onSubmit={handleQuickAdd} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={quickInput}
                onChange={e => setQuickInput(e.target.value)}
                placeholder="Was brauchst du? (z.B. Milch, 3 Bananen, 500g Mehl...)"
                className="w-full px-4 py-3 rounded-2xl bg-slate-950/80 border border-white/15 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
              />
              {quickInput && (
                <button
                  type="button"
                  onClick={() => setQuickInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!quickInput.trim()}
              className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all shrink-0"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Hinzufügen</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`p-3 rounded-2xl border transition-colors shrink-0 ${
                showAdvanced || manualCategory !== 'auto' || assignedMemberId
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-950/50 text-slate-400 border-white/10 hover:text-white'
              }`}
              title="Optionen / Zuweisung"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Optional Details Drawer */}
          {showAdvanced && (
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/10 flex flex-wrap items-center gap-3 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">Kategorie:</span>
                <select
                  value={manualCategory}
                  onChange={e => setManualCategory(e.target.value as any)}
                  className="px-2.5 py-1 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none"
                >
                  <option value="auto">Automatisch erkennen</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">Zuständig:</span>
                <select
                  value={assignedMemberId}
                  onChange={e => setAssignedMemberId(e.target.value)}
                  className="px-2.5 py-1 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none"
                >
                  <option value="">Alle</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.avatar} {m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </form>

        {/* 1-Click Quick Chips */}
        <div>
          <p className="text-[11px] font-semibold text-slate-400 mb-2">Schnelltasten (1 Klick zum Hinzufügen):</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 text-xs font-medium border border-white/10 hover:border-emerald-500/30 transition-all active:scale-95 shadow-sm"
              >
                <span>{chip.emoji}</span>
                <span>{chip.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
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
          <h3 className="text-base font-semibold text-white">Einkaufsliste ist leer</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `Keine Treffer für "${searchQuery}".`
              : 'Nutze die Schnelltasten oben oder tippe einen Artikel ein, um deine Liste zu füllen.'}
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
                          type="button"
                          onClick={() => handleToggleItem(item)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 ${
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
                              type="button"
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
                              type="button"
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
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                            style={{
                              backgroundColor: `${assignedMember.color}15`,
                              borderColor: `${assignedMember.color}40`,
                              color: assignedMember.color
                            }}
                          >
                            <span>{assignedMember.avatar}</span>
                            <span>{assignedMember.name}</span>
                          </div>
                        )}

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => setEditingItem(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Bearbeiten"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
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
                <label className="block text-xs font-medium text-slate-300 mb-1">Artikelname</label>
                <input
                  type="text"
                  required
                  value={editingItem.title}
                  onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Menge</label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={editingItem.quantity || ''}
                    onChange={e => setEditingItem({ ...editingItem, quantity: parseFloat(e.target.value) || undefined })}
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

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Kategorie</label>
                <select
                  value={editingItem.category}
                  onChange={e => setEditingItem({ ...editingItem, category: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c} className="bg-slate-900">{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Zuständiges Mitglied</label>
                <select
                  value={editingItem.assignedMemberId || ''}
                  onChange={e => setEditingItem({ ...editingItem, assignedMemberId: e.target.value || undefined })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white text-xs focus:outline-none"
                >
                  <option value="" className="bg-slate-900">Niemand zugewiesen (Alle)</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id} className="bg-slate-900">{m.avatar} {m.name}</option>
                  ))}
                </select>
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
