'use client';

import React, { useState } from 'react';
import { AuthService } from '../lib/auth';
import { AuthSession } from '../lib/types';
import {
  Activity,
  Sparkles,
  Mail,
  Lock,
  User,
  Home,
  Users,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AuthViewProps {
  onAuthSuccess: (session: AuthSession) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [householdOption, setHouseholdOption] = useState<'create' | 'join'>('create');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    if (mode === 'login') {
      const res = await AuthService.login({ email, password });
      setIsLoading(false);
      if (res.success && res.session) {
        try {
          confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
        } catch {}
        onAuthSuccess(res.session);
      } else {
        setErrorMessage(res.error || 'Ungültige E-Mail-Adresse oder Passwort.');
      }
    } else {
      // Register
      const res = await AuthService.register({
        email,
        password,
        name,
        householdName: householdOption === 'create' ? (householdName || `Familie ${name}`) : undefined,
        inviteCode: householdOption === 'join' ? inviteCode.trim() : undefined
      });
      setIsLoading(false);

      if (res.success && res.session) {
        try {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 } });
        } catch {}
        onAuthSuccess(res.session);
      } else {
        setErrorMessage(res.error || 'Registrierung fehlgeschlagen.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden bg-slate-950">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-xl shadow-emerald-500/25 mb-1">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Willkommen bei <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">HomePulse</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Dein smarter Familien- & Haushalts-Hub mit KI-Sprachsteuerung
          </p>
        </div>

        {/* Auth Box */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl bg-slate-900/90 space-y-5">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-950/70 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
              }}
              className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                mode === 'register'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Registrieren
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Anmelden
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field (Register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Dein Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="z.B. Markus oder Sarah"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-Mail-Adresse *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@beispiel.de"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Passwort *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Household Selection (Register only) */}
            {mode === 'register' && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="block text-xs font-semibold text-slate-300">
                  Haushalt
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHouseholdOption('create')}
                    className={`p-2.5 rounded-xl text-left border transition-all flex flex-col gap-1 ${
                      householdOption === 'create'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                        : 'bg-slate-950/50 border-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-300">
                      <Home className="w-3.5 h-3.5" />
                      <span>Neu gründen</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Neuer Familien-Haushalt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHouseholdOption('join')}
                    className={`p-2.5 rounded-xl text-left border transition-all flex flex-col gap-1 ${
                      householdOption === 'join'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                        : 'bg-slate-950/50 border-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-blue-300">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Beitreten</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Mit Einladungscode</span>
                  </button>
                </div>

                {householdOption === 'create' ? (
                  <div>
                    <input
                      type="text"
                      value={householdName}
                      onChange={e => setHouseholdName(e.target.value)}
                      placeholder={name ? `Familie ${name}` : 'Haushaltsname (z.B. Familie Kaufmann)'}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      required={householdOption === 'join'}
                      value={inviteCode}
                      onChange={e => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="Einladungscode eingeben (z.B. HP-8492)"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-xs uppercase tracking-wider focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === 'register' ? 'Kostenlos registrieren' : 'Jetzt anmelden'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Benefits Guarantee */}
        <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400 px-2">
          <div className="flex flex-col items-center gap-1">
            <span className="text-emerald-400 font-bold">100% Kostenlos</span>
            <span>Azure Free Tier</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-blue-400 font-bold">Echtzeit-Sync</span>
            <span>Für alle Geräte</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-purple-400 font-bold">KI-Assistent</span>
            <span>Smarte Sprache</span>
          </div>
        </div>
      </div>
    </div>
  );
};
