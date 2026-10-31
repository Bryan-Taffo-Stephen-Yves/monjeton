import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarHeart, HeartHandshake, Loader2, Sprout, Utensils } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import EnableNotificationsCard from "@/components/EnableNotificationsCard";
import {
  AGE_THRESHOLDS,
  BABY_NAME_MAX_LENGTH,
  agree,
  ageLabel,
  babyStatusQueryKey,
  cleanBabyName,
  describeBaby,
  elide,
  growthMessage,
  pronoun,
  validateBabyName,
  type BabyStatus,
  type BabyVariant,
} from "@/lib/baby";
import { BabyAvatar } from "./BabyAvatar";
import { HungerGauge } from "./HungerGauge";
import { invalidateBabyStatus, patchBabyStatus } from "./useBabyStatus";

type BabyPatch = Partial<{ name: string; variant: BabyVariant; notifications_enabled: boolean }>;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("mt-5", className)}>
      <h3 className="mb-2 text-sm font-bold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

export interface BabyDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  status: BabyStatus;
  now?: Date;
}

/** Réglages du bébé : prénom, fille / garçon, rappels, et comment ça marche. */
export default function BabyDetailsSheet({ open, onOpenChange, userId, status, now }: BabyDetailsSheetProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const view = describeBaby(status, now);
  const ids = useId();
  const [name, setName] = useState(status.name);
  const [savingName, setSavingName] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setName(status.name);
      setNameTouched(false);
    }
  }, [open, status.name]);

  const il = pronoun(status.variant);
  const Il = capitalize(il);
  const clean = cleanBabyName(name);
  const nameError = validateBabyName(name);
  const nameChanged = clean !== status.name;

  /** Applique tout de suite, puis enregistre ; revient en arrière en cas d'échec. */
  const save = async (patch: BabyPatch, optimistic: Partial<BabyStatus>): Promise<boolean> => {
    const key = babyStatusQueryKey(userId);
    const previous = queryClient.getQueryData<BabyStatus | null>(key);
    patchBabyStatus(queryClient, userId, optimistic);
    const { error } = await supabase.from("baby_companions").update(patch).eq("user_id", userId);
    if (error) {
      queryClient.setQueryData(key, previous);
      toast({
        title: "Modification non enregistrée",
        description: "Vérifie ta connexion et réessaie.",
        variant: "destructive",
      });
      return false;
    }
    void invalidateBabyStatus(queryClient);
    return true;
  };

  const submitName = async (e: FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    if (nameError || !nameChanged) return;
    setSavingName(true);
    const ok = await save({ name: clean }, { name: clean });
    setSavingName(false);
    if (ok) {
      setNameTouched(false);
      toast({ title: `${Il} s'appelle maintenant ${clean} 💚` });
    }
  };

  const born = new Date(status.bornAt);
  const bornLabel = Number.isNaN(born.getTime())
    ? null
    : born.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const nameId = `${ids}-name`;
  const nameErrId = `${ids}-name-error`;
  const switchId = `${ids}-notif`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh] border-border bg-card">
        <div className="mx-auto w-full max-w-md overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))]">
          <DrawerHeader className="px-0 pb-0 text-center">
            <div
              className="mx-auto rounded-[28px]"
              style={{
                background:
                  "radial-gradient(circle at 50% 62%, hsl(var(--primary) / 0.24), hsl(var(--primary) / 0.05) 60%, transparent 74%)",
              }}
            >
              <BabyAvatar
                variant={status.variant}
                age={view.age}
                mood={view.mood}
                size={148}
                alt={`${status.name}, ${view.ageLabel.toLowerCase()}`}
              />
            </div>
            <DrawerTitle className="mt-1 text-2xl font-extrabold">{status.name}</DrawerTitle>
            <DrawerDescription className="text-sm">
              {view.ageLabel}
              {bornLabel && ` · ${agree(status.variant, "Né", "Née")} le ${bornLabel}`}
            </DrawerDescription>
          </DrawerHeader>

          <div className="mt-4 rounded-2xl border border-border bg-background/40 p-3.5">
            <p className="text-[13px] leading-snug text-foreground">{view.message}</p>
            <HungerGauge percent={view.hunger} name={status.name} className="mt-3" />
            <div className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-muted-foreground">
              <Sprout className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1">{growthMessage(status.name, status.variant, status.fedDays)}</span>
              <span className="shrink-0 tabular-nums" aria-label={`${status.fedDays} jours de repas`}>
                {view.next ? `${status.fedDays} / ${AGE_THRESHOLDS[view.next.age]}` : status.fedDays}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={view.next ? `Croissance vers ${view.next.label.toLowerCase()}` : "Croissance terminée"}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(view.progress * 100)}
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.max(4, view.progress * 100)}%` }} />
            </div>
          </div>

          <Section title="Prénom">
            <form onSubmit={submitName} noValidate className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor={nameId} className="sr-only">
                  Prénom de ton bébé
                </label>
                <Input
                  id={nameId}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={BABY_NAME_MAX_LENGTH + 8}
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint="done"
                  aria-invalid={nameTouched && !!nameError}
                  aria-describedby={nameTouched && nameError ? nameErrId : undefined}
                  className="h-11 rounded-xl text-base"
                />
                {nameTouched && nameError && (
                  <p id={nameErrId} role="alert" className="mt-1.5 text-xs font-semibold text-destructive">
                    {nameError}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={!nameChanged || savingName}
                className="bg-primary inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-extrabold text-primary-foreground transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40"
              >
                {savingName && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Enregistrer
              </button>
            </form>
          </Section>

          <Section title="Fille ou garçon">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Fille ou garçon">
              {(["girl", "boy"] as const).map((v) => {
                const selected = status.variant === v;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => !selected && save({ variant: v }, { variant: v })}
                    className={cn(
                      "flex h-14 items-center gap-2 rounded-xl border-2 px-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    <BabyAvatar variant={v} age={view.age} mood="happy" size={44} alt="" cues={false} animated={false} />
                    {v === "girl" ? "Une fille" : "Un garçon"}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title={`Quand ${status.name} a faim`}>
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/40 p-3.5">
              <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <label htmlFor={switchId} className="text-sm font-semibold text-foreground">
                  {status.name} peut t'envoyer un message
                </label>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Au plus un par jour, à partir de 2 jours sans dépense notée. {Il} se tait après une semaine.
                </p>
              </div>
              <Switch
                id={switchId}
                checked={status.notificationsEnabled}
                onCheckedChange={(checked) =>
                  save({ notifications_enabled: checked }, { notificationsEnabled: checked })
                }
                className="mt-0.5 data-[state=checked]:bg-primary"
              />
            </div>
          </Section>

          {status.notificationsEnabled && (
            <Section title={`Active les notifications pour ${elide("que", status.name)} puisse t'appeler`}>
              <EnableNotificationsCard />
            </Section>
          )}

          <Section title="Comment ça marche ?">
            <ul className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
              <li className="flex gap-3">
                <Utensils className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Chaque jour où tu notes au moins une dépense ou un revenu, {status.name} mange à sa faim.
                </span>
              </li>
              <li className="flex gap-3">
                <Sprout className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Plus tu notes souvent, plus {il} grandit : {ageLabel("baby", status.variant).toLowerCase()} après{" "}
                  {AGE_THRESHOLDS.baby} jours de repas, {ageLabel("toddler", status.variant).toLowerCase()} après{" "}
                  {AGE_THRESHOLDS.toddler}, {ageLabel("kid", status.variant).toLowerCase()} après {AGE_THRESHOLDS.kid}. {Il} ne
                  rapetisse jamais.
                </span>
              </li>
              <li className="flex gap-3">
                <CalendarHeart className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Si tu l'oublies, son biberon se vide petit à petit et {il} a faim. {Il} ne tombe jamais malade.
                </span>
              </li>
              <li className="flex gap-3">
                <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>Une seule dépense notée, et {il} retrouve le sourire.</span>
              </li>
            </ul>
          </Section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
