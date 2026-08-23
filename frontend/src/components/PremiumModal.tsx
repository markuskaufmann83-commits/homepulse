'use client';

import React, { useState, useEffect } from 'react';
import { GooglePlayProduct, SubscriptionStatus } from '../lib/types';
import { GooglePlayBillingService } from '../lib/billing';
import { loadSubscription } from '../lib/storage';
import {
  Crown,
  Sparkles,
  Check,
  Zap,
  ShieldCheck,
  RefreshCw,
  X,
  CreditCard,
  HeartHandshake
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose }) => {
  const [products, setProducts] = useState<GooglePlayProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('homepulse_family_yearly');
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    const prods = await GooglePlayBillingService.getProducts();
    setProducts(prods);
    setSubscription(loadSubscription());
  };

  if (!isOpen) return null;

  const handlePurchase = async () => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const result = await GooglePlayBillingService.purchase(selectedProductId);
      if (result.success && result.subscription) {
        setSubscription(result.subscription);
        try {
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.6 }
          });
        } catch {}
        setStatusMessage({ text: result.message, isError: false });
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setStatusMessage({ text: result.message, isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Kaufvorgang fehlgeschlagen', isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const result = await GooglePlayBillingService.restorePurchases();
      if (result.success && result.subscription) {
        setSubscription(result.subscription);
        setStatusMessage({ text: result.message, isError: false });
      } else {
        setStatusMessage({ text: result.message, isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: 'Wiederherstellung fehlgeschlagen', isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const isSubscribed = subscription?.tier === 'family_plus' && subscription?.active;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl glass-panel bg-slate-900/95 border border-white/15 shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-xl shadow-amber-500/25 mb-1">
            <Crown className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            HomePulse <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Family Plus</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Schalte alle Premium-Funktionen für den gesamten Haushalt frei – nahtlos abgerechnet über Google Play.
          </p>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mb-5 p-3 rounded-2xl text-xs font-medium flex items-center gap-2 ${
              statusMessage.isError
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {statusMessage.isError ? <X className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Already Subscribed View */}
        {isSubscribed ? (
          <div className="space-y-6 text-center py-4">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-amber-200 text-sm">
              <p className="font-bold flex items-center justify-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                Family Plus ist für diesen Haushalt aktiv!
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {subscription?.isLifetime
                  ? 'Lifetime Family Pass (Kein Ablaufdatum)'
                  : `Gültig bis: ${subscription?.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString('de-DE') : 'Aktiv'}`}
              </p>
              {subscription?.orderId && (
                <p className="text-[10px] text-slate-500 mt-1 font-mono">Bestell-ID: {subscription.orderId}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {subscription?.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 text-xs text-slate-200">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
            >
              Schließen
            </button>
          </div>
        ) : (
          /* Subscription Plans Grid */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {products.map(prod => {
                const isSelected = selectedProductId === prod.id;
                const isBestValue = prod.id === 'homepulse_family_yearly';

                return (
                  <div
                    key={prod.id}
                    onClick={() => setSelectedProductId(prod.id)}
                    className={`relative p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/60 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {isBestValue && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold uppercase tracking-wider shadow">
                        Bester Wert (30% Rabatt)
                      </span>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white leading-snug">{prod.title}</h4>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'bg-amber-400 border-amber-400 text-slate-950' : 'border-slate-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>

                      <p className="text-lg font-extrabold text-white mt-1">{prod.price}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{prod.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 space-y-1.5">
                      {prod.features.slice(0, 3).map((f, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Google Play & Safety Guarantee */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-xs text-slate-300">
                <p className="font-semibold text-white">Sicher über Google Play abrechnen</p>
                <p className="text-[11px] text-slate-400">
                  Jederzeit mit einem Klick im Google Play Store kündbar. Gilt für alle Geräte und Familienmitglieder im Haushalt.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handlePurchase}
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-sm font-extrabold flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span>Jetzt über Google Play abonnieren</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-1">
                <button
                  onClick={handleRestore}
                  disabled={isLoading}
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Kauf wiederherstellen</span>
                </button>
                <span>•</span>
                <span className="text-[11px] text-slate-500">Google Play Billing API v7</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
