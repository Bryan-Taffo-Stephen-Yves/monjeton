import { useState, useEffect } from 'react';
import WalletIcon from '@/components/WalletIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { formatMoneyDisplay } from '@/lib/formatAmount';
import {
  Check, Edit3, CheckCircle2, AlertTriangle,
  Loader2, Sparkles, ChevronDown,
  Image as ImageIcon, Wand2,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Screen } from '@/components/layout/Screen';
import { DatePickerField } from "@/components/ui/DatePickerField";

interface DetectedTransaction {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  type: 'expense' | 'income';
  category_suggestion: string;
  note: string;
  confidence: number;
  raw_text: string;
  issues: string;
}

interface ScanResult {
  document_type: string;
  total_detected: number;
  transactions: DetectedTransaction[];
  global_confidence: number;
  warnings: string[];
}

interface ValidatorItem extends DetectedTransaction {
  selected: boolean;
  editing: boolean;
  wallet_id: string | null;
}

interface CategoryRow {
  id: string;
  name: string;
  type: string;
}

interface WalletRow {
  id: string;
  wallet_name: string;
}

interface Props {
  scanResult: ScanResult;
  imagePreview: string | null;
  storagePath?: string | null;
  onClose: () => void;
  onValidated: (count: number) => void;
}

const FALLBACK_CATEGORIES = [
  'Alimentation', 'Transport', 'Communication',
  'Santé', 'Loisirs', 'Éducation', 'Factures',
  'Shopping', 'Transfert', 'Autre',
];

const DOC_TYPE_LABELS: Record<string, string> = {
  receipts_physical: 'Reçus physiques',
  wave_screenshot: 'Capture Wave',
  orange_money_screenshot: 'Capture Orange Money',
  bank_statement: 'Relevé bancaire',
  invoice: 'Facture',
  mixed: 'Documents mixtes',
  unknown: 'Type inconnu',
};

export const MultiReceiptValidator = ({
  scanResult, imagePreview, storagePath, onClose, onValidated,
}: Props) => {
  const { user } = useAuth();

  const [items, setItems] = useState<ValidatorItem[]>(() =>
    scanResult.transactions.map(tx => ({
      ...tx,
      selected: tx.confidence >= 0.5,
      editing: false,
      wallet_id: null,
    }))
  );

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const [catRes, walRes] = await Promise.all([
        supabase.from('categories').select('id, name, type').eq('user_id', user.id),
        supabase.from('wallets').select('id, wallet_name').eq('user_id', user.id),
      ]);
      const cats = (catRes.data as CategoryRow[]) || [];
      const wals = (walRes.data as WalletRow[]) || [];
      setCategories(cats);
      setWallets(wals);
      // Default wallet on each item
      if (wals.length > 0) {
        setItems(prev => prev.map(it => ({
          ...it,
          wallet_id: it.wallet_id ?? wals[0].id,
        })));
      }
    };
    load();
  }, [user]);

  const selectedCount = items.filter(i => i.selected).length;
  const totalAmount = items
    .filter(i => i.selected)
    .reduce((s, i) => s + i.amount, 0);

  const updateItem = (id: string, patch: Partial<ValidatorItem>) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...patch } : item
    ));
  };

  const selectAll = () => {
    setItems(prev => prev.map(item => ({ ...item, selected: true })));
  };

  const deselectAll = () => {
    setItems(prev => prev.map(item => ({ ...item, selected: false })));
  };

  const applyBulkCategory = () => {
    if (!bulkCategory) return;
    let count = 0;
    setItems(prev => prev.map(item => {
      if (item.selected) {
        count++;
        return { ...item, category_suggestion: bulkCategory };
      }
      return item;
    }));
    if (count > 0) {
      toast({ title: `Catégorie appliquée à ${count} transaction(s)` });
    } else {
      toast({ title: 'Aucune transaction sélectionnée', variant: 'destructive' });
    }
  };

  const findCategoryId = async (name: string, type: string): Promise<string | null> => {
    if (!user) return null;
    const existing = categories.find(c =>
      c.name.toLowerCase() === name.toLowerCase() && c.type === type
    );
    if (existing) return existing.id;

    const { data } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name,
        type,
        icon: 'MoreHorizontal',
        color: 'hsl(0,0%,60%)',
      })
      .select('id')
      .single();
    return data?.id || null;
  };

  const handleValidate = async () => {
    if (!user || selectedCount === 0) return;
    setSaving(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      if (!item.selected) continue;
      try {
        const catId = await findCategoryId(
          item.category_suggestion,
          item.type === 'income' ? 'income' : 'expense'
        );

        const { error } = await supabase.from('transactions').insert({
          user_id: user.id,
          amount: item.amount,
          type: item.type,
          date: item.date,
          note: item.merchant + (item.note ? ` - ${item.note}` : ''),
          category_id: catId,
          wallet_id: item.wallet_id,
          source: 'scan',
        } as any);

        if (error) throw error;

        await supabase.from('receipt_scans').insert({
          user_id: user.id,
          scan_type: 'photo',
          parsed_merchant: item.merchant,
          parsed_amount: item.amount,
          parsed_date: item.date,
          status: 'confirmed',
          extracted_text: item.raw_text,
          storage_path: storagePath ?? null,
        });

        successCount++;
      } catch (e) {
        console.error('Failed to save tx:', item.id, e);
        failCount++;
      }
    }

    setSaving(false);

    if (successCount > 0) {
      toast({
        title: `${successCount} transaction(s) enregistrée(s)`,
        description: failCount > 0 ? `${failCount} échec(s)` : 'Toutes sauvegardées avec succès',
      });
      onValidated(successCount);
    } else {
      toast({ title: 'Aucune transaction sauvegardée', variant: 'destructive' });
    }
  };

  const getConfidenceColor = (c: number) => {
    if (c >= 0.8) return 'text-primary';
    if (c >= 0.5) return 'text-yellow-500';
    return 'text-destructive';
  };

  const getConfidenceLabel = (c: number) => {
    if (c >= 0.8) return 'Fiable';
    if (c >= 0.5) return 'Incertain';
    return 'Douteux';
  };

  // Build category options for the per-item Select (filtered by item type when possible)
  const categoryOptionsFor = (type: 'expense' | 'income') => {
    const filtered = categories.filter(c => c.type === type);
    if (filtered.length > 0) return filtered.map(c => c.name);
    if (categories.length > 0) return categories.map(c => c.name);
    return FALLBACK_CATEGORIES;
  };

  const allCategoryNames = categories.length > 0
    ? Array.from(new Set(categories.map(c => c.name)))
    : FALLBACK_CATEGORIES;

  const isSingle = scanResult.total_detected === 1;

  return (
    <Screen>
      <Screen.Content className="space-y-4">
        <div className="space-y-4">
      {/* Header résumé */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground truncate">
              {DOC_TYPE_LABELS[scanResult.document_type] || 'Document'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {scanResult.total_detected} transaction(s) détectée(s)
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Sélectionnées</p>
            <div className="text-lg font-bold text-primary tabular-nums">
              {selectedCount}/{scanResult.total_detected}
            </div>
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="flex items-center justify-between bg-primary/10 rounded-xl px-3 py-2">
            <span className="text-xs text-muted-foreground">Total à enregistrer</span>
            <span className="text-base font-bold text-primary tabular-nums">
              {formatMoneyDisplay(totalAmount)}
            </span>
          </div>
        )}

        {scanResult.warnings.length > 0 && (
          <div className="space-y-1">
            {scanResult.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-yellow-500 bg-yellow-500/10 rounded-lg p-2">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aperçu image */}
      {imagePreview && (
        <button
          onClick={() => setShowImage(!showImage)}
          className="w-full glass-card rounded-xl p-3 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ImageIcon className="w-4 h-4" />
          {showImage ? "Masquer l'image" : "Voir l'image scannée"}
          <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showImage ? 'rotate-180' : ''}`} />
        </button>
      )}

      <AnimatePresence>
        {showImage && imagePreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl"
          >
            <img src={imagePreview} alt="Scan" className="w-full rounded-xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions globales — masquées si une seule transaction */}
      {!isSingle && (
        <>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="flex-1 glass-card rounded-xl py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Tout sélectionner
            </button>
            <button
              onClick={deselectAll}
              className="flex-1 glass-card rounded-xl py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Tout désélectionner
            </button>
          </div>

          <div className="glass-card rounded-xl p-3 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Appliquer une catégorie à toutes les transactions sélectionnées
            </p>
            <div className="flex gap-2">
              <Select value={bulkCategory} onValueChange={setBulkCategory}>
                <SelectTrigger className="bg-secondary border-border h-9 text-xs flex-1">
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {allCategoryNames.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={applyBulkCategory}
                disabled={!bulkCategory || selectedCount === 0}
                size="sm"
                className="h-9 gradient-primary text-primary-foreground text-xs"
              >
                <Wand2 className="w-3 h-3 mr-1" />
                Appliquer
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Liste des transactions */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`glass-card rounded-2xl p-3 space-y-3 transition-all ${
              item.selected ? 'ring-1 ring-primary/40' : 'opacity-60'
            }`}
          >
            {/* Header transaction */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {item.editing ? (
                  <Input
                    value={item.merchant}
                    onChange={(e) => updateItem(item.id, { merchant: e.target.value })}
                    className="bg-secondary border-border text-sm font-bold h-8 mb-1"
                    autoFocus
                  />
                ) : (
                  <p className="text-sm font-bold text-foreground truncate">{item.merchant}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-medium ${getConfidenceColor(item.confidence)}`}>
                    {getConfidenceLabel(item.confidence)} ({Math.round(item.confidence * 100)}%)
                  </span>
                  {item.issues && (
                    <span className="text-[10px] text-yellow-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {item.issues}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => updateItem(item.id, { selected: !item.selected })}
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
                  item.selected
                    ? 'gradient-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                <Check className="w-4 h-4" />
              </button>
            </div>

            {/* Montant + catégorie */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Montant</p>
                {item.editing ? (
                  <MoneyInput
                    value={item.amount}
                    onChange={(v) => updateItem(item.id, { amount: v })}
                    className="bg-secondary border-border h-8"
                  />
                ) : (
                  <div className={`text-sm font-bold tabular-nums ${item.type === 'income' ? 'text-primary' : 'text-foreground'}`}>
                    {item.type === 'income' ? '+' : '-'}{formatMoneyDisplay(item.amount)}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Catégorie</p>
                <Select
                  value={item.category_suggestion}
                  onValueChange={(v) => updateItem(item.id, { category_suggestion: v })}
                >
                  <SelectTrigger className="bg-secondary border-border h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptionsFor(item.type).map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Portefeuille + Date */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Portefeuille</p>
                <Select
                  value={item.wallet_id ?? ''}
                  onValueChange={(v) => updateItem(item.id, { wallet_id: v })}
                >
                  <SelectTrigger className="bg-secondary border-border h-8 text-xs">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map(w => (
                      <SelectItem key={w.id} value={w.id}>
                        <span className="inline-flex items-center gap-2">
                          <WalletIcon name={w.wallet_name} size={18} />
                          {w.wallet_name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Date</p>
                {item.editing ? (
                  <DatePickerField value={item.date} onChange={(v) => updateItem(item.id, { date: v })} className="w-full bg-secondary border-border text-xs" />
                ) : (
                  <div className="text-xs text-foreground h-8 flex items-center px-2 bg-secondary/50 rounded-lg">
                    {new Date(item.date).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Type */}
            <div>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Type</p>
              <div className="flex gap-1">
                {(['expense', 'income'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => updateItem(item.id, { type: t })}
                    className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all ${
                      item.type === t
                        ? t === 'income'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-foreground'
                        : 'glass text-muted-foreground'
                    }`}
                  >
                    {t === 'expense' ? 'Dépense' : 'Revenu'}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            {(item.editing || item.note) && (
              <div>
                <Input
                  value={item.note}
                  onChange={(e) => updateItem(item.id, { note: e.target.value })}
                  placeholder="Note (optionnel)"
                  className="bg-secondary border-border text-xs h-8"
                />
              </div>
            )}

            {/* Bouton modifier */}
            <button
              onClick={() => updateItem(item.id, { editing: !item.editing })}
              className={`w-full text-xs py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 ${
                item.editing
                  ? 'bg-primary/15 text-primary'
                  : 'glass text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.editing ? (
                <><CheckCircle2 className="w-3 h-3" /> Confirmer les modifications</>
              ) : (
                <><Edit3 className="w-3 h-3" /> Modifier</>
              )}
            </button>
          </motion.div>
        ))}
      </div>
        </div>
      </Screen.Content>

      <Screen.StickyAction>
        <div className="space-y-2">
          <Button
            onClick={handleValidate}
            disabled={selectedCount === 0 || saving}
            className="w-full gradient-primary text-primary-foreground font-bold h-12"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement...</>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {isSingle
                  ? 'Enregistrer cette transaction'
                  : <>Enregistrer {selectedCount} transaction(s){selectedCount > 0 && ` · ${formatMoneyDisplay(totalAmount)}`}</>}
              </>
            )}
          </Button>

          <button
            onClick={onClose}
            className="w-full text-xs text-muted-foreground py-1 hover:text-foreground"
          >
            Annuler et recommencer
          </button>
        </div>
      </Screen.StickyAction>
    </Screen>
  );
};

export default MultiReceiptValidator;
