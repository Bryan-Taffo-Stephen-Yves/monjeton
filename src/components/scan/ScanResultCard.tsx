import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Edit3, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Label } from "@/components/ui/label";
import { openJekoPro } from "@/lib/jeko";
import { isStoreApp } from "@/lib/platform";
import { DatePickerField } from "@/components/ui/DatePickerField";

export interface ParsedResult {
  amount?: number;
  date?: string;
  merchant?: string;
  type?: string;
  category?: string;
  wallet?: string;
  currency?: string;
  original_amount?: number;
  converted_amount_xof?: number;
  exchange_rate_used?: number;
  exchange_rate_source?: string;
  conversion_error?: string;
}

const CURRENCIES = ["XOF", "USD", "EUR", "GBP", "NGN", "GHS"];

interface ScanResultCardProps {
  result: ParsedResult;
  categories: any[];
  wallets: any[];
  onConfirm: (data: ParsedResult) => void;
  onReject: () => void;
  isPremium: boolean;
}

const ScanResultCard = ({ result, categories, wallets, onConfirm, onReject, isPremium }: ScanResultCardProps) => {
  const [editMode, setEditMode] = useState(false);
  const [editResult, setEditResult] = useState<ParsedResult>({ ...result });

  const data = editMode ? editResult : result;
  const needsConversion = data.currency && data.currency !== "XOF";
  const hasConversion = data.converted_amount_xof != null && data.exchange_rate_used != null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Résultat de l'analyse</h3>
        <button onClick={() => setEditMode(!editMode)} className="text-primary text-xs flex items-center gap-1">
          <Edit3 className="w-3 h-3" /> {editMode ? "Aperçu" : "Modifier"}
        </button>
      </div>

      {editMode ? (
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Montant original</Label>
            <div className="flex gap-2">
              <MoneyInput
                value={editResult.original_amount ?? editResult.amount ?? 0}
                onChange={(n) => setEditResult({ ...editResult, original_amount: n, amount: n })}
                showCurrency={false}
                className="flex-1 [&>input]:glass"
              />
              <select
                value={editResult.currency || "XOF"}
                onChange={(e) => setEditResult({ ...editResult, currency: e.target.value })}
                className="rounded-lg bg-background/50 border border-border px-2 text-foreground text-sm w-24"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {editResult.currency && editResult.currency !== "XOF" && (
            <div>
              <Label className="text-xs text-muted-foreground">Taux de change personnalisé (1 {editResult.currency} = ? XOF)</Label>
              <Input
                type="number"
                value={editResult.exchange_rate_used || ""}
                onChange={(e) => {
                  const rate = Number(e.target.value);
                  const amt = editResult.original_amount ?? editResult.amount ?? 0;
                  setEditResult({
                    ...editResult,
                    exchange_rate_used: rate,
                    converted_amount_xof: Math.round(amt * rate),
                    exchange_rate_source: "manual",
                  });
                }}
                className="glass"
                placeholder="Ex: 610"
              />
            </div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground">Commerçant</Label>
            <Input value={editResult.merchant || ""} onChange={(e) => setEditResult({ ...editResult, merchant: e.target.value })} className="glass" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Date</Label>
            <DatePickerField value={editResult.date || ""} onChange={(v) => setEditResult({ ...editResult, date: v })} className="glass" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Type</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditResult({ ...editResult, type: "expense" })} className={`flex-1 py-1.5 rounded-lg text-xs ${editResult.type === "expense" ? "bg-destructive text-destructive-foreground" : "glass text-muted-foreground"}`}>Dépense</button>
              <button type="button" onClick={() => setEditResult({ ...editResult, type: "income" })} className={`flex-1 py-1.5 rounded-lg text-xs ${editResult.type === "income" ? "gradient-primary text-primary-foreground" : "glass text-muted-foreground"}`}>Revenu</button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Catégorie</Label>
            <select value={editResult.category || ""} onChange={(e) => setEditResult({ ...editResult, category: e.target.value })} className="w-full rounded-lg bg-background/50 border border-border p-2 text-foreground text-sm">
              <option value="">Choisir</option>
              {categories.filter((c) => c.type === (editResult.type || "expense")).map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Portefeuille</Label>
            <select value={editResult.wallet || ""} onChange={(e) => setEditResult({ ...editResult, wallet: e.target.value })} className="w-full rounded-lg bg-background/50 border border-border p-2 text-foreground text-sm">
              <option value="">Aucun</option>
              {wallets.map((w) => <option key={w.id} value={w.wallet_name}>{w.wallet_name}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Currency conversion info */}
          {needsConversion && hasConversion && (
            <div className="glass rounded-xl p-3 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRightLeft className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-primary">Conversion de devise</span>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  Montant original : <span className="font-semibold text-foreground">{(data.original_amount ?? data.amount)?.toLocaleString("fr-FR")} {data.currency}</span>
                </p>
                <p className="text-muted-foreground">
                  Montant converti : <span className="font-semibold text-foreground">{data.converted_amount_xof?.toLocaleString("fr-FR")} XOF</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Taux : 1 {data.currency} = {data.exchange_rate_used} XOF ({data.exchange_rate_source})
                </p>
              </div>
            </div>
          )}

          {needsConversion && !hasConversion && data.conversion_error && (
            <div className="glass rounded-xl p-3 border border-destructive/30">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-xs font-medium text-destructive">Conversion impossible</span>
              </div>
              <p className="text-xs text-muted-foreground">{data.conversion_error}</p>
              <p className="text-xs text-muted-foreground mt-1">Cliquez sur "Modifier" pour saisir un taux manuellement.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            {data.amount != null && (
              <div className="glass rounded-xl p-3">
                <p className="text-muted-foreground text-xs">Montant {needsConversion ? "(XOF)" : ""}</p>
                <p className="font-bold text-foreground">
                  {(needsConversion && hasConversion ? data.converted_amount_xof : data.amount)?.toLocaleString("fr-FR")}
                </p>
              </div>
            )}
            {data.merchant && (
              <div className="glass rounded-xl p-3">
                <p className="text-muted-foreground text-xs">Commerçant</p>
                <p className="font-bold text-foreground">{data.merchant}</p>
              </div>
            )}
            {data.date && (
              <div className="glass rounded-xl p-3">
                <p className="text-muted-foreground text-xs">Date</p>
                <p className="font-bold text-foreground">{data.date}</p>
              </div>
            )}
            {data.type && (
              <div className="glass rounded-xl p-3">
                <p className="text-muted-foreground text-xs">Type</p>
                <p className="font-bold text-foreground">{data.type === "expense" ? "Dépense" : "Revenu"}</p>
              </div>
            )}
            {data.category && (
              <div className="glass rounded-xl p-3">
                <p className="text-muted-foreground text-xs">Catégorie</p>
                <p className="font-bold text-foreground">{data.category}</p>
              </div>
            )}
            {data.wallet && (
              <div className="glass rounded-xl p-3">
                <p className="text-muted-foreground text-xs">Portefeuille</p>
                <p className="font-bold text-foreground">{data.wallet}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!isPremium ? (
        isStoreApp() ? (
          <div className="glass rounded-xl p-4 text-center space-y-1">
            <p className="text-sm font-semibold text-foreground">Fonctionnalité réservée à Mon Jeton Pro</p>
          </div>
        ) : (
          <div className="glass rounded-xl p-4 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground">🔒 Fonctionnalité Premium</p>
            <p className="text-xs text-muted-foreground">Débloquez Scan Intelligent avec le plan PRO pour enregistrer automatiquement vos transactions.</p>
            <Button onClick={() => openJekoPro()} className="gradient-primary text-primary-foreground w-full">
              Passer à PRO →
            </Button>
          </div>
        )
      ) : (
        <div className="flex gap-3">
          <Button onClick={() => onConfirm(data)} className="flex-1 gradient-primary text-primary-foreground">
            <Check className="w-4 h-4 mr-2" /> Confirmer
          </Button>
          <Button onClick={onReject} variant="outline" className="flex-1 glass">
            <X className="w-4 h-4 mr-2" /> Rejeter
          </Button>
        </div>
      )}
    </motion.div>
  );
};

export default ScanResultCard;
