import type { Lang } from "./i18n";

export const LANDING_STRINGS = {
  fr: {
    // Navbar
    nav_features: "Fonctionnalités",
    nav_pricing: "Tarifs",
    nav_faq: "FAQ",
    nav_home: "Accueil",
    nav_testimonials: "Témoignages",
    nav_contact: "Contact",
    nav_login: "Se connecter",
    nav_signup: "S'inscrire",

    // Hero
    hero_line1: "Suivez vos",
    hero_word_expenses: "dépenses",
    hero_word_income: "revenus",
    hero_word_savings: "épargne",
    hero_subtitle:
      "Mon Jeton suit vos dépenses en FCFA, gère vos tontines et scanne vos reçus par IA. Sans stocker un centime chez nous.",
    hero_cta_signup: "S'inscrire",
    hero_cta_pro: "Prendre le plan Pro",
    hero_cta_demo: "Voir la démo",
    hero_trust: "Rejoins 2 500+ utilisateurs",

    // Phone hero
    phone_hello: "Bonjour",
    phone_vs_month: "12% vs juin",
    phone_expenses_july: "Dépenses de juillet",
    phone_income: "Revenus",
    phone_expenses: "Dépenses",
    phone_freelance: "Freelance",
    phone_restaurant: "Restaurant",

    // Floating cards (hero)
    fc_alert: "Alerte dépense",
    fc_alert_sub: "resto ce mois-ci",
    fc_scan: "Scan AI",
    fc_scan_val: "Reçu en 2 s",
    fc_tontine: "Tontine Bureau",
    fc_tontine_val: "7/10 à jour",
    fc_budget: "Budget Transport",
    fc_budget_val: "Reste 12 000 F",

    // PaymentMarquee
    marquee_title: "Compatible avec vos moyens de paiement",

    // FeatureShowcase
    feat_badge: "Fonctionnalité",
    // Voice
    feat_voice_before: "Parlez, on",
    feat_voice_word: "note tout",
    feat_voice_p:
      "Dites « J'ai dépensé 3 000 au marché et payé 15 000 de taxi » — l'IA détecte chaque transaction, le montant et la catégorie.",
    feat_voice_pts: [
      "Plusieurs transactions en une phrase",
      "Devises détectées (FCFA, €, $)",
      "Catégorie assignée automatiquement",
    ],
    voice_header: "Saisie vocale",
    voice_ai: "IA",
    voice_quote: "« J'ai dépensé 3 000 au marché et payé 15 000 de taxi »",
    voice_market: "Marché · Alimentation",
    voice_taxi: "Taxi · Transport",
    voice_confirm: "Confirmer les 2",
    fc_voice_multi: "Multi-transactions",
    fc_voice_multi_val: "2 détectées",
    fc_voice_cat: "Catégorie auto",
    fc_voice_cat_val: "Alimentation",

    // Scan
    feat_scan_before: "Photographiez, c'est",
    feat_scan_word: "enregistré",
    feat_scan_p:
      "Le scan IA lit le montant, la date et le commerçant sur le reçu, puis crée la transaction toute seule.",
    feat_scan_pts: [
      "Montant & date lus automatiquement",
      "Commerçant reconnu",
      "Reçu archivé et retrouvable",
    ],
    scan_header: "Scan de facture",
    scan_ready: "Prêt",
    scan_merchant: "Commerçant",
    scan_amount: "Montant",
    scan_category: "Catégorie",
    scan_food: "Alimentation",
    scan_save: "Enregistrer",
    fc_scan_amount: "Montant lu",
    fc_scan_archived: "Reçu archivé",
    fc_scan_archived_val: "Mes reçus",

    // Savings
    feat_savings_before: "Fixez un objectif,",
    feat_savings_word: "atteignez-le",
    feat_savings_p:
      "Créez un objectif d'épargne, versez à votre rythme et suivez votre progression jusqu'au but.",
    feat_savings_pts: [
      "Objectifs illimités",
      "Progression en temps réel",
      "Versements à votre rythme",
    ],
    savings_header: "Mes objectifs",
    savings_active: "3 actifs",
    savings_total: "Épargne totale",
    savings_goal_dakar: "Voyage Dakar",
    savings_goal_emergency: "Fonds d'urgence",
    savings_goal_phone: "Nouveau tel",
    fc_savings_goal: "Objectif Dakar",
    fc_savings_remain: "Reste",
    fc_savings_remain_val: "180 000 F",

    // Debts
    feat_debts_before: "Qui vous doit quoi,",
    feat_debts_word: "enfin clair",
    feat_debts_p:
      "Suivez ce qu'on vous doit et ce que vous devez, avec rappels automatiques. Fini les dettes oubliées.",
    feat_debts_pts: [
      "Vues « On me doit » / « Je dois »",
      "Rappels automatiques",
      "Solde net calculé",
    ],
    debts_header: "Dettes",
    debts_net: "Net +55 000",
    debts_owed_to_me: "On me doit",
    debts_i_owe: "Je dois",
    debts_lent_on: "Prêté le",
    debts_remind: "Relancer Koffi",
    fc_debts_owed: "On me doit",
    fc_debts_owed_val: "+85 000 F",
    fc_debts_reminder: "Rappel auto",
    fc_debts_reminder_val: "dans 3 jours",

    // Pricing
    pricing_title: "Tarifs simples et transparents",
    pricing_subtitle:
      "Choisissez le plan qui vous convient. Changez ou annulez à tout moment.",
    pricing_monthly: "Mensuel",
    pricing_yearly: "Annuel",
    pricing_recommended: "Recommandé",
    pricing_per_month: "mois",
    pricing_per_year: "an",
    plan_free_name: "Gratuit",
    plan_free_desc:
      "Pour découvrir Mon Jeton et commencer à suivre vos finances.",
    plan_free_cta: "S'inscrire",
    plan_free_features: [
      "1 portefeuille",
      "15 dépenses saisies / mois",
      "5 scans IA et 5 saisies vocales / mois",
      "Catégorisation automatique",
      "Rapports basiques",
    ],
    plan_pro_name: "Pro",
    plan_pro_desc:
      "Pour les utilisateurs réguliers qui veulent aller plus loin.",
    plan_pro_cta: "S'abonner",
    plan_pro_features: [
      "Dépenses illimitées",
      "Scan IA des reçus (30/mois)",
      "Saisie vocale (30/mois)",
      "Assistant IA financier",
      "Rapports avancés & export PDF",
      "Tontines & dettes",
    ],
    plan_max_name: "Ultra Pro",
    plan_max_desc:
      "L'expérience complète pour les pros et les heavy users.",
    plan_max_cta: "S'abonner",
    plan_max_features: [
      "Tout le plan Pro",
      "Scan IA et saisie vocale illimités",
      "Support prioritaire",
      "Accès anticipé aux nouvelles features",
    ],

    // Testimonials
    testi_badge: "Témoignages",
    testi_title_before: "Ils gèrent mieux leur",
    testi_title_word: "argent",
    testi_items: [
      {
        quote: "Depuis Mon Jeton, je sais enfin où part mon argent chaque mois. Les tontines gérées toutes seules, un vrai soulagement.",
        initial: "A",
        name: "Aminata K.",
        role: "Maman, Abidjan",
      },
      {
        quote: "Je note mes ventes à la voix pendant que je sers les clients. Le scan des factures me fait gagner un temps fou.",
        initial: "Y",
        name: "Yao B.",
        role: "Commerçant, Adjamé",
      },
      {
        quote: "J'ai atteint mon objectif d'épargne pour mon téléphone en 4 mois. L'appli me motive vraiment à mettre de côté.",
        initial: "F",
        name: "Fatou D.",
        role: "Étudiante, Cocody",
      },
    ],

    // Landing pricing block
    pricing_landing_badge: "Abonnements",
    pricing_landing_title_before: "Choisissez votre",
    pricing_landing_title_word: "plan",
    pricing_landing_subtitle: "Commencez gratuitement, passez au Pro quand vous êtes prêt.",
    pricing_landing_popular: "Le plus populaire",
    pricing_landing_per_month: "FCFA / mois",
    pricing_landing_secure_note: "Paiement sécurisé via Jèko",
    pl_free_name: "Gratuit",
    pl_free_yearly: "pour toujours",
    pl_free_features: [
      "15 dépenses saisies / mois",
      "5 scans IA et 5 saisies vocales / mois",
      "Tontines & caisses de base",
      "1 objectif d'épargne",
      "Historique 30 jours",
    ],
    pl_free_button: "S'inscrire",
    pl_pro_name: "Pro",
    pl_pro_yearly: "ou 19 900 FCFA / an",
    pl_pro_features: [
      "Dépenses illimitées",
      "Scan de factures IA (30 / mois)",
      "Saisie vocale intelligente (30 / mois)",
      "Objectifs d'épargne illimités",
      "Rapports détaillés & dettes",
    ],
    pl_pro_button: "Prendre Pro",
    pl_ultra_name: "Ultra Pro",
    pl_ultra_yearly: "ou 49 900 FCFA / an",
    pl_ultra_features: [
      "Tout le plan Pro",
      "Scan IA et saisie vocale illimités",
      "Mode entreprise",
      "Multi-comptes",
      "Export comptable",
      "Support prioritaire",
    ],
    pl_ultra_button: "Prendre Ultra Pro",


    // FAQ
    faq_title: "Questions fréquentes",
    faqs: [
      {
        q: "Comment fonctionne la conversion de devises ?",
        a: "Mon Jeton détecte automatiquement la devise sur vos factures et reçus. Si le montant est en USD, EUR ou toute autre devise, il est converti en FCFA au taux du jour en temps réel.",
      },
      {
        q: "Comment fonctionne le scan IA ?",
        a: "Prenez en photo votre facture ou capture d'écran Mobile Money. Notre IA détecte le marchand, le montant, la devise et la date, puis crée la transaction automatiquement.",
      },
      {
        q: "Mes données sont-elles sécurisées ?",
        a: "Absolument. Toutes vos données sont chiffrées de bout en bout et stockées de manière sécurisée. Nous ne partageons jamais vos informations financières avec des tiers.",
      },
      {
        q: "Le mode entreprise, c'est quoi ?",
        a: "Le mode entreprise permet de créer un espace de travail partagé avec votre équipe. Invitez des membres, suivez les dépenses communes, consultez l'historique d'audit et communiquez via le chat intégré.",
      },
      {
        q: "Mon Jeton est-il disponible sur mobile ?",
        a: "Oui ! Mon Jeton est disponible sur Android et iOS. Vous pouvez aussi utiliser l'application web depuis n'importe quel navigateur.",
      },
      {
        q: "Quels moyens de paiement sont supportés ?",
        a: "Mon Jeton supporte Orange Money, MTN MoMo, Wave, Moov Money, ainsi que les cartes Visa et Mastercard.",
      },
    ],

    // Final CTA
    final_title: "Prêt à voir clair dans ton jeton ?",
    final_subtitle:
      "Créez votre compte maintenant et prenez le contrôle de vos finances.",
    final_cta: "S'inscrire",

    // Footer
    footer_slogan: "« Tu vas voir clair dans ton jeton. »",
    footer_links: "Liens",
    footer_contact: "Contact",
    footer_features: "Fonctionnalités",
    footer_pricing: "Tarifs",
    footer_faq: "FAQ",
    footer_rights: "© 2026 Djaitech. Tous droits réservés.",
    footer_privacy: "Confidentialité",
    footer_terms: "CGU",
  },

  en: {
    // Navbar
    nav_features: "Features",
    nav_pricing: "Pricing",
    nav_faq: "FAQ",
    nav_home: "Home",
    nav_testimonials: "Testimonials",
    nav_contact: "Contact",
    nav_login: "Sign in",
    nav_signup: "Sign up",

    // Hero
    hero_line1: "Track your",
    hero_word_expenses: "expenses",
    hero_word_income: "income",
    hero_word_savings: "savings",
    hero_subtitle:
      "Mon Jeton tracks your spending in FCFA, manages your tontines and scans your receipts with AI. Without holding a single coin of yours.",
    hero_cta_signup: "Sign up",
    hero_cta_pro: "Get the Pro plan",
    hero_cta_demo: "Watch the demo",
    hero_trust: "Join 2,500+ users",

    // Phone hero
    phone_hello: "Hello",
    phone_vs_month: "12% vs June",
    phone_expenses_july: "July spending",
    phone_income: "Income",
    phone_expenses: "Expenses",
    phone_freelance: "Freelance",
    phone_restaurant: "Restaurant",

    // Floating cards (hero)
    fc_alert: "Spending alert",
    fc_alert_sub: "eating out this month",
    fc_scan: "AI Scan",
    fc_scan_val: "Receipt in 2s",
    fc_tontine: "Office tontine",
    fc_tontine_val: "7/10 on time",
    fc_budget: "Transport budget",
    fc_budget_val: "12,000 F left",

    // PaymentMarquee
    marquee_title: "Works with your payment methods",

    // FeatureShowcase
    feat_badge: "Feature",
    feat_voice_before: "Just talk, we",
    feat_voice_word: "log it all",
    feat_voice_p:
      "Say \"I spent 3,000 at the market and paid 15,000 for a taxi\" — the AI detects every transaction, amount and category.",
    feat_voice_pts: [
      "Several transactions in one sentence",
      "Currencies detected (FCFA, €, $)",
      "Category assigned automatically",
    ],
    voice_header: "Voice entry",
    voice_ai: "AI",
    voice_quote: "\"I spent 3,000 at the market and paid 15,000 for a taxi\"",
    voice_market: "Market · Food",
    voice_taxi: "Taxi · Transport",
    voice_confirm: "Confirm both",
    fc_voice_multi: "Multi-transactions",
    fc_voice_multi_val: "2 detected",
    fc_voice_cat: "Auto category",
    fc_voice_cat_val: "Food",

    feat_scan_before: "Snap a photo, it's",
    feat_scan_word: "logged",
    feat_scan_p:
      "The AI scan reads the amount, date and merchant on the receipt, then creates the transaction on its own.",
    feat_scan_pts: [
      "Amount & date read automatically",
      "Merchant recognized",
      "Receipt archived and searchable",
    ],
    scan_header: "Receipt scan",
    scan_ready: "Ready",
    scan_merchant: "Merchant",
    scan_amount: "Amount",
    scan_category: "Category",
    scan_food: "Food",
    scan_save: "Save",
    fc_scan_amount: "Amount read",
    fc_scan_archived: "Receipt saved",
    fc_scan_archived_val: "My receipts",

    feat_savings_before: "Set a goal,",
    feat_savings_word: "reach it",
    feat_savings_p:
      "Create a savings goal, pay in at your own pace and track your progress all the way.",
    feat_savings_pts: [
      "Unlimited goals",
      "Real-time progress",
      "Pay in at your own pace",
    ],
    savings_header: "My goals",
    savings_active: "3 active",
    savings_total: "Total savings",
    savings_goal_dakar: "Trip to Dakar",
    savings_goal_emergency: "Emergency fund",
    savings_goal_phone: "New phone",
    fc_savings_goal: "Dakar goal",
    fc_savings_remain: "Remaining",
    fc_savings_remain_val: "180,000 F",

    feat_debts_before: "Who owes what,",
    feat_debts_word: "finally clear",
    feat_debts_p:
      "Track what people owe you and what you owe, with automatic reminders. No more forgotten debts.",
    feat_debts_pts: [
      "\"Owed to me\" / \"I owe\" views",
      "Automatic reminders",
      "Net balance calculated",
    ],
    debts_header: "Debts",
    debts_net: "Net +55,000",
    debts_owed_to_me: "Owed to me",
    debts_i_owe: "I owe",
    debts_lent_on: "Lent on",
    debts_remind: "Nudge Koffi",
    fc_debts_owed: "Owed to me",
    fc_debts_owed_val: "+85,000 F",
    fc_debts_reminder: "Auto reminder",
    fc_debts_reminder_val: "in 3 days",

    // Pricing
    pricing_title: "Simple, transparent pricing",
    pricing_subtitle:
      "Pick the plan that fits you. Change or cancel anytime.",
    pricing_monthly: "Monthly",
    pricing_yearly: "Yearly",
    pricing_recommended: "Recommended",
    pricing_per_month: "month",
    pricing_per_year: "year",
    plan_free_name: "Free",
    plan_free_desc: "Discover Mon Jeton and start tracking your finances.",
    plan_free_cta: "Sign up",
    plan_free_features: [
      "1 wallet",
      "15 manual expenses / month",
      "5 AI scans and 5 voice entries / month",
      "Automatic categorization",
      "Basic reports",
    ],
    plan_pro_name: "Pro",
    plan_pro_desc: "For regular users who want to go further.",
    plan_pro_cta: "Subscribe",
    plan_pro_features: [
      "Unlimited expenses",
      "AI receipt scan (30/month)",
      "Voice entry (30/month)",
      "AI financial assistant",
      "Advanced reports & PDF export",
      "Tontines & debts",
    ],
    plan_max_name: "Ultra Pro",
    plan_max_desc: "The full experience for pros and heavy users.",
    plan_max_cta: "Subscribe",
    plan_max_features: [
      "Everything in Pro",
      "Unlimited AI scan and voice entry",
      "Priority support",
      "Early access to new features",
    ],

    // Testimonials
    testi_badge: "Testimonials",
    testi_title_before: "They manage their",
    testi_title_word: "money",
    testi_items: [
      {
        quote: "Since Mon Jeton, I finally know where my money goes every month. Tontines run themselves — a huge relief.",
        initial: "A",
        name: "Aminata K.",
        role: "Mom, Abidjan",
      },
      {
        quote: "I log my sales by voice while serving customers. The receipt scan saves me a ton of time.",
        initial: "Y",
        name: "Yao B.",
        role: "Shopkeeper, Adjamé",
      },
      {
        quote: "I hit my savings goal for a new phone in 4 months. The app really motivates me to set money aside.",
        initial: "F",
        name: "Fatou D.",
        role: "Student, Cocody",
      },
    ],

    // Landing pricing block
    pricing_landing_badge: "Plans",
    pricing_landing_title_before: "Choose your",
    pricing_landing_title_word: "plan",
    pricing_landing_subtitle: "Start free, upgrade to Pro when you're ready.",
    pricing_landing_popular: "Most popular",
    pricing_landing_per_month: "FCFA / month",
    pricing_landing_secure_note: "Secure payment via Jèko",
    pl_free_name: "Free",
    pl_free_yearly: "forever",
    pl_free_features: [
      "15 manual expenses / month",
      "5 AI scans and 5 voice entries / month",
      "Basic tontines & pools",
      "1 savings goal",
      "30-day history",
    ],
    pl_free_button: "Sign up",
    pl_pro_name: "Pro",
    pl_pro_yearly: "or 19,900 FCFA / year",
    pl_pro_features: [
      "Unlimited expenses",
      "AI receipt scan (30 / month)",
      "Smart voice entry (30 / month)",
      "Unlimited savings goals",
      "Detailed reports & debts",
    ],
    pl_pro_button: "Get Pro",
    pl_ultra_name: "Ultra Pro",
    pl_ultra_yearly: "or 49,900 FCFA / year",
    pl_ultra_features: [
      "Everything in Pro",
      "Unlimited AI scan and voice entry",
      "Business mode",
      "Multi-accounts",
      "Accounting export",
      "Priority support",
    ],
    pl_ultra_button: "Get Ultra Pro",



    // FAQ
    faq_title: "Frequently asked questions",
    faqs: [
      {
        q: "How does currency conversion work?",
        a: "Mon Jeton automatically detects the currency on your invoices and receipts. If the amount is in USD, EUR or any other currency, it is converted to FCFA at the live daily rate.",
      },
      {
        q: "How does the AI scan work?",
        a: "Take a picture of your invoice or Mobile Money screenshot. Our AI detects the merchant, amount, currency and date, then creates the transaction automatically.",
      },
      {
        q: "Is my data secure?",
        a: "Absolutely. All your data is end-to-end encrypted and stored securely. We never share your financial information with third parties.",
      },
      {
        q: "What is business mode?",
        a: "Business mode lets you create a shared workspace with your team. Invite members, track shared expenses, review the audit log and chat inside the app.",
      },
      {
        q: "Is Mon Jeton available on mobile?",
        a: "Yes! Mon Jeton is available on Android and iOS. You can also use the web app from any browser.",
      },
      {
        q: "Which payment methods are supported?",
        a: "Mon Jeton supports Orange Money, MTN MoMo, Wave, Moov Money, plus Visa and Mastercard cards.",
      },
    ],

    // Final CTA
    final_title: "Ready to see clearly into your money?",
    final_subtitle: "Create your account now and take control of your finances.",
    final_cta: "Sign up",

    // Footer
    footer_slogan: "\"See clearly into your money.\"",
    footer_links: "Links",
    footer_contact: "Contact",
    footer_features: "Features",
    footer_pricing: "Pricing",
    footer_faq: "FAQ",
    footer_rights: "© 2026 Djaitech. All rights reserved.",
    footer_privacy: "Privacy",
    footer_terms: "Terms",
  },
} as const;

export type LandingStrings = (typeof LANDING_STRINGS)["fr"];

export const getLandingStrings = (lang: Lang): LandingStrings =>
  (LANDING_STRINGS[lang] as unknown as LandingStrings) ?? LANDING_STRINGS.fr;
