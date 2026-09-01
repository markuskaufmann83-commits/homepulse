'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, Check, Trash2, X, AlertCircle, ShoppingCart, Calendar, MessageSquare, UserCheck, Volume2 } from 'lucide-react';
import { AiAction, AiParseResponse } from '../lib/types';
import { Api } from '../lib/api';
import { getTodayDateStr } from '../lib/dateUtils';
import confetti from 'canvas-confetti';

interface VoiceAssistantProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onActionCompleted?: () => void;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  isOpen: controlledIsOpen,
  onOpenChange,
  onActionCompleted
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const setOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
  };

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedResult, setParsedResult] = useState<AiParseResponse | null>(null);
  const [editableActions, setEditableActions] = useState<(AiAction & { selected: boolean })[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const recognitionRef = useRef<any>(null);
  const actionsContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'de-DE';

        recognition.onstart = () => {
          setIsListening(true);
          setTranscript('');
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
          setTextInput(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const speakText = (text: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Spracherkennung wird in diesem Browser nicht unterstützt. Du kannst den Text direkt eingeben.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  const handleProcessText = async (customPrompt?: string) => {
    const promptToUse = customPrompt || textInput || transcript;
    if (!promptToUse.trim()) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setIsLoading(true);
    setFeedbackMessage(null);

    try {
      const members = await Api.getMembers();
      const memberNames = members.map(m => m.name);
      const res = await Api.parseAiPrompt(promptToUse, memberNames);

      setParsedResult(res);
      setEditableActions(
        res.actions.map(a => ({
          ...a,
          selected: true
        }))
      );

      const count = res.actions.length;
      speakText(`Ich habe ${count} ${count === 1 ? 'Aktion' : 'Aktionen'} für dich erkannt.`);

      // Auto-scroll to actions card
      setTimeout(() => {
        if (actionsContainerRef.current) {
          actionsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    } catch (err) {
      console.error('Error parsing AI prompt:', err);
      setFeedbackMessage('Fehler bei der Analyse. Bitte nochmals versuchen.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActionSelected = (index: number) => {
    setEditableActions(prev =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const removeAction = (index: number) => {
    setEditableActions(prev => prev.filter((_, i) => i !== index));
  };

  const executeApprovedActions = async () => {
    const toExecute = editableActions.filter(a => a.selected);
    if (toExecute.length === 0) return;

    setIsLoading(true);

    try {
      const members = await Api.getMembers();

      for (const action of toExecute) {
        if (action.type === 'SHOPPING_ADD') {
          const targetMember = members.find(
            m => m.name.toLowerCase() === (action.assignedTo || '').toLowerCase() ||
                 m.name.toLowerCase().includes((action.assignedTo || '').toLowerCase())
          );
          await Api.addShoppingItem({
            title: action.item,
            category: action.category || 'Sonstiges',
            quantity: action.quantity,
            unit: action.unit,
            assignedMemberId: targetMember?.id
          });
        } else if (action.type === 'CALENDAR_ADD') {
          let assignedIds: string[] = ['all'];
          if (action.assignedTo && action.assignedTo.toLowerCase() !== 'alle') {
            const found = members.find(m =>
              m.name.toLowerCase() === action.assignedTo!.toLowerCase() ||
              m.name.toLowerCase().includes(action.assignedTo!.toLowerCase())
            );
            if (found) assignedIds = [found.id];
          }
          await Api.addCalendarEvent({
            title: action.title,
            date: action.date || getTodayDateStr(),
            time: action.time,
            endTime: action.endTime,
            location: action.location,
            assignedMemberIds: assignedIds
          });
        } else if (action.type === 'FEED_POST') {
          const author = members.find(
            m => m.name.toLowerCase() === (action.author || '').toLowerCase() ||
                 m.name.toLowerCase().includes((action.author || '').toLowerCase())
          ) || members[0];

          await Api.addFeedPost({
            content: action.content,
            type: action.postType || 'note',
            authorId: author.id
          });
        } else if (action.type === 'STATUS_UPDATE') {
          const member = members.find(
            m => m.name.toLowerCase() === action.memberName.toLowerCase() ||
                 m.name.toLowerCase().includes(action.memberName.toLowerCase())
          );
          if (member) {
            member.status = action.newStatus;
            if (action.statusMessage) member.statusMessage = action.statusMessage;
            await Api.updateMember(member);
          }
        }
      }

      // Immediately notify all components of data change
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('homepulse-data-change', { detail: { resource: 'all' } }));
      }

      // Trigger Confetti & Voice
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.8 } });
      } catch {}
      speakText('Aktionen erfolgreich ausgeführt!');

      setFeedbackMessage(`${toExecute.length} Aktion(en) erfolgreich ausgeführt! 🎉`);
      setTimeout(() => {
        setParsedResult(null);
        setEditableActions([]);
        setTextInput('');
        setTranscript('');
        setOpen(false);
        setFeedbackMessage(null);
        if (onActionCompleted) onActionCompleted();
      }, 1200);
    } catch (err) {
      console.error('Error executing actions:', err);
      setFeedbackMessage('Fehler beim Speichern der Aktionen.');
    } finally {
      setIsLoading(false);
    }
  };

  const samplePrompts = [
    'Milch, Eier und Vollkornbrot auf die Einkaufsliste setzen',
    'Trage für morgen um 15:00 Uhr Zahnarzttermin im Kalender ein',
    'Erstelle einen Termin: Kindergeburtstag am Freitag um 16 Uhr',
    'Bin auf dem Heimweg von der Arbeit'
  ];

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setOpen(true)}
          className="group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="KI Sprachassistent öffnen"
        >
          <Sparkles className="w-6 h-6 text-white group-hover:rotate-12 transition-transform duration-300" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900"></span>
          </span>
        </button>
      </div>

      {/* Voice Assistant Modal Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-3xl glass-panel bg-slate-900/95 border border-white/15 shadow-2xl p-6 overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Smart Voice & KI-Assistent</h3>
                  <p className="text-xs text-slate-400">Sprich oder tippe deine Wünsche frei ein</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  className={`p-2 rounded-xl border transition-colors ${
                    ttsEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'text-slate-500 border-white/5 hover:bg-white/5'
                  }`}
                  title={ttsEnabled ? 'Sprachausgabe aktiv' : 'Sprachausgabe stumm'}
                >
                  <Volume2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Listening Wave Visualizer or Text Input */}
            <div className="my-6 space-y-4">
              <div className="flex flex-col items-center justify-center py-6 px-4 rounded-2xl bg-slate-950/60 border border-white/10 relative overflow-hidden">
                {/* Visualizer Sound Waves */}
                {isListening ? (
                  <div className="flex items-center gap-1.5 h-16">
                    <div className="w-1.5 h-6 bg-emerald-400 rounded-full animate-wave" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1.5 h-12 bg-teal-400 rounded-full animate-wave" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1.5 h-16 bg-cyan-400 rounded-full animate-wave" style={{ animationDelay: '0.3s' }}></div>
                    <div className="w-1.5 h-10 bg-emerald-400 rounded-full animate-wave" style={{ animationDelay: '0.4s' }}></div>
                    <div className="w-1.5 h-14 bg-teal-400 rounded-full animate-wave" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1.5 h-8 bg-cyan-400 rounded-full animate-wave" style={{ animationDelay: '0.5s' }}></div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 text-xs py-2">
                    {transcript || 'Drücke auf das Mikrofon oder wähle einen Beispielsatz:'}
                  </div>
                )}

                {/* Mic Trigger Button */}
                <button
                  onClick={toggleListening}
                  className={`mt-4 relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ${
                    isListening
                      ? 'bg-rose-500 text-white ring-4 ring-rose-500/30 scale-110 shadow-lg shadow-rose-500/50'
                      : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:scale-105 border border-emerald-500/40'
                  }`}
                >
                  {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>

                <span className="text-[11px] font-medium mt-2 text-slate-400">
                  {isListening ? 'Zuhören... (Klicke zum Stoppen)' : 'Mikrofon starten'}
                </span>
              </div>

              {/* Text Input & Submit */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleProcessText()}
                  placeholder="z.B. Bio-Eier auf die Liste und Freitag 16 Uhr Kindergeburtstag..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
                <button
                  onClick={() => handleProcessText()}
                  disabled={isLoading || !textInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Analysieren</span>
                </button>
              </div>

              {/* Sample Prompts */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-slate-400">Vorschläge zum Ausprobieren:</p>
                <div className="flex flex-col gap-1.5">
                  {samplePrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setTextInput(prompt);
                        handleProcessText(prompt);
                      }}
                      className="text-left text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors border border-white/5 truncate"
                    >
                      💬 &quot;{prompt}&quot;
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Feedback Message */}
            {feedbackMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{feedbackMessage}</span>
              </div>
            )}

            {/* Action Approval Card */}
            {parsedResult && editableActions.length > 0 && (
              <div ref={actionsContainerRef} className="mt-4 pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white">Erkannte Aktionen zur Freigabe</h4>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/10">
                    Quelle: {parsedResult.source === 'rule_based' ? 'Lokaler NLP-Parser' : 'LLM KI'}
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {editableActions.map((action, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                        action.selected
                          ? 'bg-slate-800/80 border-emerald-500/40'
                          : 'bg-slate-900/50 border-white/5 opacity-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={action.selected}
                        onChange={() => toggleActionSelected(idx)}
                        className="mt-1 w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
                      />

                      <div className="flex-1 text-xs space-y-1">
                        {action.type === 'SHOPPING_ADD' && (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold flex items-center gap-1">
                                <ShoppingCart className="w-3 h-3" /> Einkauf
                              </span>
                              <input
                                type="text"
                                value={action.item}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditableActions(prev => prev.map((a, i) => i === idx ? { ...a, item: val } : a));
                                }}
                                className="font-semibold text-white bg-transparent border-b border-white/20 focus:outline-none focus:border-emerald-400 px-1"
                              />
                            </div>
                            <div className="flex items-center gap-3 text-slate-400 text-[11px] mt-1">
                              <span>Kategorie: <strong className="text-slate-200">{action.category || 'Sonstiges'}</strong></span>
                              <span>Zuweisung: <strong className="text-slate-200">{action.assignedTo || 'Familie'}</strong></span>
                            </div>
                          </div>
                        )}

                        {action.type === 'CALENDAR_ADD' && (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Termin
                              </span>
                              <input
                                type="text"
                                value={action.title}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditableActions(prev => prev.map((a, i) => i === idx ? { ...a, title: val } : a));
                                }}
                                className="font-semibold text-white bg-transparent border-b border-white/20 focus:outline-none focus:border-blue-400 px-1 flex-1"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-slate-400 text-[11px] mt-1.5">
                              <div className="flex items-center gap-1">
                                <span>Datum:</span>
                                <input
                                  type="date"
                                  value={action.date}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setEditableActions(prev => prev.map((a, i) => i === idx ? { ...a, date: val } : a));
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-200 text-[11px] focus:outline-none"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span>Uhrzeit:</span>
                                <input
                                  type="time"
                                  value={action.time || '12:00'}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setEditableActions(prev => prev.map((a, i) => i === idx ? { ...a, time: val } : a));
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-200 text-[11px] focus:outline-none"
                                />
                              </div>
                              <span>Für: <strong className="text-slate-200">{action.assignedTo || 'Alle'}</strong></span>
                            </div>
                          </div>
                        )}

                        {action.type === 'FEED_POST' && (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> Pinnwand
                              </span>
                              <span className="text-slate-200">&quot;{action.content}&quot;</span>
                            </div>
                          </div>
                        )}

                        {action.type === 'STATUS_UPDATE' && (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold flex items-center gap-1">
                                <UserCheck className="w-3 h-3" /> Status
                              </span>
                              <span className="text-white font-medium">{action.memberName}</span>
                              <span className="text-slate-400">➔ {action.newStatus}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => removeAction(idx)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Aktion verwerfen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setParsedResult(null);
                      setEditableActions([]);
                    }}
                    className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Verwerfen
                  </button>
                  <button
                    onClick={executeApprovedActions}
                    disabled={isLoading || editableActions.filter(a => a.selected).length === 0}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
                  >
                    <Check className="w-4 h-4" />
                    <span>Bestätigen & Ausführen ({editableActions.filter(a => a.selected).length})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
