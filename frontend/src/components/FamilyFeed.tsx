'use client';

import React, { useState, useEffect } from 'react';
import { FeedPost, FamilyMember, FeedPostType, MemberStatus } from '../lib/types';
import { Api } from '../lib/api';
import { getCurrentUser } from '../lib/storage';
import {
  MessageSquare,
  Pin,
  Send,
  Trash2,
  Utensils,
  Bell,
  Sparkles,
  Heart,
  Smile,
  Navigation,
  Briefcase,
  GraduationCap,
  Home,
  MessageCircle,
  Filter,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

const EMOJI_OPTIONS = ['❤️', '👍', '😋', '🎉', '🚗', '☕'];

export const FamilyFeed: React.FC = () => {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [currentUser, setCurrentUser] = useState<FamilyMember | null>(null);

  // New post input
  const [newContent, setNewContent] = useState('');
  const [postType, setPostType] = useState<FeedPostType>('note');
  const [isPinned, setIsPinned] = useState(false);

  // Filter
  const [filterType, setFilterType] = useState<string>('all');

  // Comment input per post
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const loadData = async () => {
    const [fetchedPosts, fetchedMembers] = await Promise.all([
      Api.getFeedPosts(),
      Api.getMembers()
    ]);
    setPosts(fetchedPosts);
    setMembers(fetchedMembers);
    setCurrentUser(getCurrentUser());
  };

  useEffect(() => {
    loadData();
    const handleDataChange = (e: any) => {
      const res = e?.detail?.resource;
      if (!res || res === 'feed' || res === 'members' || res === 'all') {
        loadData();
      }
    };
    window.addEventListener('homepulse-data-change', handleDataChange);
    return () => window.removeEventListener('homepulse-data-change', handleDataChange);
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    await Api.addFeedPost({
      content: newContent.trim(),
      type: postType,
      authorId: currentUser?.id || members[0]?.id || 'mem_1',
      pinned: isPinned
    });

    setNewContent('');
    setIsPinned(false);
    await loadData();
  };

  const handleToggleReaction = async (postId: string, emoji: string) => {
    if (!currentUser) return;
    await Api.togglePostReaction(postId, emoji, currentUser.id);
    await loadData();
  };

  const handleAddComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser) return;

    await Api.addFeedComment(postId, commentText.trim(), currentUser.id);
    setCommentText('');
    setActiveCommentPostId(null);
    await loadData();
  };

  const handleDeletePost = async (id: string) => {
    await Api.getFeedPosts();
    const remaining = posts.filter(p => p.id !== id);
    setPosts(remaining);
    const { saveFeedPosts } = await import('../lib/storage');
    saveFeedPosts(remaining);
  };

  // Fast status updates
  const handleQuickStatus = async (status: MemberStatus, message: string, emoji: string) => {
    if (!currentUser) return;
    const updated = {
      ...currentUser,
      status,
      statusMessage: message,
      updatedAt: new Date().toISOString()
    };
    await Api.updateMember(updated);
    await Api.addFeedPost({
      content: `${message} ${emoji}`,
      type: 'status',
      authorId: currentUser.id
    });
    try {
      confetti({ particleCount: 25, spread: 35, origin: { y: 0.85 } });
    } catch {}
    await loadData();
  };

  const getAuthor = (authorId: string) => members.find(m => m.id === authorId);

  const formatTimestamp = (isoStr: string) => {
    const date = new Date(isoStr);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffMins < 1440) return `vor ${Math.floor(diffMins / 60)} Std.`;
    return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // Filtered posts
  const filteredPosts = posts.filter(p => {
    if (filterType === 'all') return true;
    return p.type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Header & Status Quick Broadcast */}
      <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Familien-Pinnwand & Feed</h2>
            <p className="text-xs text-slate-400">Schnelle Status-Updates, Notizen und Mahlzeiten für alle</p>
          </div>
        </div>

        {/* Fast Broadcast Buttons */}
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs font-semibold text-slate-300 mb-2">Schnell-Status teilen ({currentUser?.name}):</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => handleQuickStatus('home', 'Bin jetzt zuhause', '🏠')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30 transition-all active:scale-95"
            >
              <Home className="w-4 h-4" />
              <span>Bin daheim 🏠</span>
            </button>
            <button
              onClick={() => handleQuickStatus('away', 'Bin auf dem Heimweg', '🚗')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-medium border border-amber-500/30 transition-all active:scale-95"
            >
              <Navigation className="w-4 h-4" />
              <span>Auf Heimweg 🚗</span>
            </button>
            <button
              onClick={() => handleQuickStatus('work', 'Im Büro / bei der Arbeit', '💼')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-500/30 transition-all active:scale-95"
            >
              <Briefcase className="w-4 h-4" />
              <span>Im Büro 💻</span>
            </button>
            <button
              onClick={() => handleQuickStatus('school', 'In der Schule / Uni', '📚')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-medium border border-purple-500/30 transition-all active:scale-95"
            >
              <GraduationCap className="w-4 h-4" />
              <span>In Schule 📚</span>
            </button>
          </div>
        </div>

        {/* Post Composer */}
        <form onSubmit={handleCreatePost} className="mt-5 pt-5 border-t border-white/10 space-y-3">
          <div className="relative">
            <textarea
              rows={2}
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Schreibe eine Notiz an die Familie (z.B. 'Essen steht im Ofen', 'Paket ist angekommen')..."
              className="w-full px-4 py-3 rounded-2xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 resize-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Typ:</span>
              <div className="flex gap-1.5">
                {[
                  { id: 'note', label: 'Notiz', icon: '📝' },
                  { id: 'meal', label: 'Mahlzeit', icon: '🍝' },
                  { id: 'alert', label: 'Wichtig', icon: '⚠️' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPostType(t.id as FeedPostType)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      postType === t.id
                        ? 'bg-purple-600 text-white border-purple-500'
                        : 'bg-slate-900/60 text-slate-400 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-1.5 text-xs text-slate-300 ml-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={e => setIsPinned(e.target.checked)}
                  className="rounded text-purple-500 focus:ring-purple-500 bg-slate-900 border-slate-700"
                />
                <Pin className="w-3.5 h-3.5 text-purple-400" />
                <span>Oben anpinnen</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!newContent.trim()}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-600/30 active:scale-95 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Veröffentlichen</span>
            </button>
          </div>
        </form>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Ansicht:</span>
        </span>
        {[
          { id: 'all', label: 'Alle Beiträge' },
          { id: 'meal', label: '🍝 Mahlzeiten' },
          { id: 'alert', label: '⚠️ Wichtig' },
          { id: 'status', label: '🚗 Status' },
          { id: 'note', label: '📝 Notizen' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilterType(f.id)}
            className={`px-3 py-1 rounded-xl text-xs font-medium border transition-all ${
              filterType === f.id
                ? 'bg-purple-600/30 text-purple-200 border-purple-500 font-bold'
                : 'bg-slate-900/60 text-slate-400 border-white/5 hover:border-white/20'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed Posts List */}
      <div className="space-y-4">
        {filteredPosts.map(post => {
          const author = getAuthor(post.authorId);
          return (
            <div
              key={post.id}
              className={`glass-panel rounded-2xl p-4 sm:p-5 border transition-all space-y-3 ${
                post.pinned
                  ? 'bg-purple-950/30 border-purple-500/40 shadow-lg shadow-purple-900/10'
                  : 'bg-slate-900/75 border-white/10 hover:border-white/20'
              }`}
            >
              {/* Post Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base shadow border"
                    style={{
                      backgroundColor: `${author?.color || '#8B5CF6'}25`,
                      borderColor: `${author?.color || '#8B5CF6'}50`
                    }}
                  >
                    <span>{author?.avatar || '👤'}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{author?.name || 'Familie'}</h4>
                      {post.pinned && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          <Pin className="w-2.5 h-2.5" />
                          Angepinnt
                        </span>
                      )}
                      {post.type === 'meal' && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          🍝 Mahlzeit
                        </span>
                      )}
                      {post.type === 'alert' && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          ⚠️ Wichtig
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">{formatTimestamp(post.timestamp)}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleDeletePost(post.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Post Content */}
              <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
                {post.content}
              </p>

              {/* Reactions Bar & Comment Trigger */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {EMOJI_OPTIONS.map(emoji => {
                    const reacts = post.reactions?.[emoji] || [];
                    const userReacted = currentUser && reacts.includes(currentUser.id);

                    return (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(post.id, emoji)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs transition-all ${
                          userReacted
                            ? 'bg-purple-500/25 border border-purple-500/50 text-purple-200 font-bold scale-105'
                            : reacts.length > 0
                            ? 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                            : 'bg-transparent text-slate-500 hover:bg-white/5 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <span>{emoji}</span>
                        {reacts.length > 0 && <span>{reacts.length}</span>}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-purple-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>
                    {post.comments && post.comments.length > 0
                      ? `${post.comments.length} Antwort${post.comments.length === 1 ? '' : 'en'}`
                      : 'Antworten'}
                  </span>
                </button>
              </div>

              {/* Comments Thread */}
              {post.comments && post.comments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                  {post.comments.map(comm => {
                    const commAuthor = getAuthor(comm.authorId);
                    return (
                      <div key={comm.id} className="flex items-start gap-2.5 bg-slate-950/40 p-2.5 rounded-xl border border-white/5 text-xs">
                        <span className="text-base">{commAuthor?.avatar || '👤'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{commAuthor?.name || 'Jemand'}</span>
                            <span className="text-[10px] text-slate-500">{formatTimestamp(comm.timestamp)}</span>
                          </div>
                          <p className="text-slate-200 mt-0.5">{comm.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Comment Input Box */}
              {activeCommentPostId === post.id && (
                <form onSubmit={e => handleAddComment(post.id, e)} className="mt-2 pt-2 border-t border-white/5 flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder={`Antworten als ${currentUser?.name || 'Du'}...`}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim()}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold"
                  >
                    Senden
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
