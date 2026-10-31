import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Baby, BusFront, Check, Heart, MapPin, Mic, ScanLine, Sprout, Target, Utensils } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { hasCompletedWelcome } from "@/lib/appEntry";
import { Back, Brand, EntryLoader, EntryShell, Primary } from "@/components/entry/EntryParts";
import supermarchePhoto from "@/assets/entry/abidjan-supermarche.webp";
import angrePhoto from "@/assets/entry/abidjan-angre.webp";
import golfPhoto from "@/assets/entry/abidjan-golf.webp";

// Décor du 4ᵉ écran (bébé Jeton) : chargé seulement quand on s'en approche.
const loadBabyStage = () => import("@/components/baby/BabyWelcomeStage");
const BabyWelcomeStage = lazy(loadBabyStage);

/**
 * Écrans de bienvenue de l'application mobile (4 slides).
 * Montrés tant que la personne ne s'est jamais inscrite ni connectée sur
 * l'appareil. Les montants affichés sont des exemples, pas ses données.
 */

interface Story {
  /** Photo d'Abidjan ; absente pour l'écran du bébé (fond dégradé). */
  photo?: string;
  place: string;
  alt: string;
  eyebrow: string;
  title: string;
  emphasis: string;
  quote: string;
}

const STORIES: Story[] = [
  {
    photo: supermarchePhoto,
    place: "SUPERMARCHÉ · ABIDJAN",
    alt: "Une maman photographie son reçu à la caisse d'un supermarché à Abidjan.",
    eyebrow: "SCAN IA + BUDGET DU MOIS",
    title: "Tes courses notées.",
    emphasis: "Ton budget au clair.",
    quote: "« Je scanne mon reçu. Je sais où j'en suis dans mon budget du mois. »",
  },
  {
    photo: angrePhoto,
    place: "ANGRÉ · ABIDJAN",
    alt: "Un étudiant assis dans une rue d'Angré tient un sachet noir et parle à son téléphone.",
    eyebrow: "SAISIE VOCALE IA",
    title: "Tu parles.",
    emphasis: "Mon Jeton note.",
    quote: "« Garba : 1 200 F. Yango pour l'université : 3 600 F ?! Mon salaire file ! »",
  },
  {
    photo: golfPhoto,
    place: "RIVIERA GOLF · ABIDJAN",
    alt: "Une jeune femme regarde son téléphone sur une terrasse verdoyante de la Riviera Golf.",
    eyebrow: "OBJECTIFS D'ÉPARGNE",
    title: "Décembre se prépare.",
    emphasis: "À ton rythme.",
    quote: "« L'argent de poche est arrivé ! J'en garde pour décembre : tenues, copines et Assinie. »",
  },
  {
    place: "TON COMPAGNON · NOUVEAU",
    alt: "Deux bébés Jeton tout contents : une petite fille et un petit garçon.",
    eyebrow: "BÉBÉ JETON",
    title: "Ton bébé Jeton",
    emphasis: "t'attend.",
    quote: "« J'ai un petit creux… Note une dépense pour me nourrir ! 🍼 »",
  },
];

function StoryFeature({ index }: { index: number }) {
  return (
    <div className={`story-feature feature-${index}`} aria-label="Aperçu de fonctionnalité, données fictives">
      {index === 0 ? (
        <>
          <div className="feature-heading">
            <ScanLine size={16} />
            <strong>Reçu reconnu par l'IA</strong>
            <span className="feature-status">
              <Check size={11} /> C'est noté
            </span>
          </div>
          <div className="budget-example">
            <span>Budget du mois</span>
            <strong>
              54 500 F <small>restants</small>
            </strong>
          </div>
          <div className="feature-progress" aria-hidden="true">
            <span style={{ width: "64%" }} />
          </div>
        </>
      ) : index === 1 ? (
        <>
          <div className="feature-heading">
            <Mic size={16} />
            <strong>2 dépenses reconnues</strong>
            <span className="voice-wave" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
          <div className="voice-transactions">
            <span>
              <Utensils size={14} /> Garba <strong>1 200 F</strong>
            </span>
            <span>
              <BusFront size={14} /> Yango · Université <strong>3 600 F</strong>
            </span>
          </div>
        </>
      ) : index === 3 ? (
        <>
          <div className="feature-heading">
            <Baby size={16} />
            <strong>Kofi · Bébé</strong>
            <span className="feature-status">
              <Heart size={11} /> Ventre plein
            </span>
          </div>
          <div className="budget-example">
            <span>Il grandit quand tu notes tes dépenses</span>
            <strong>
              <Sprout size={12} style={{ display: "inline", verticalAlign: "-1px" }} /> 12 <small>jours de repas</small>
            </strong>
          </div>
          <div className="feature-progress" aria-hidden="true">
            <span style={{ width: "85%" }} />
          </div>
        </>
      ) : (
        <>
          <div className="feature-heading">
            <Target size={16} />
            <strong>Mon décembre à moi</strong>
            <span className="feature-status">Objectif</span>
          </div>
          <div className="budget-example">
            <span>Tenues, sorties & Assinie</span>
            <strong>
              30 000 <small>/ 120 000 F</small>
            </strong>
          </div>
          <div className="feature-progress" aria-hidden="true">
            <span style={{ width: "25%" }} />
          </div>
        </>
      )}
      <small className="feature-example">Exemple · données fictives</small>
    </div>
  );
}

const AppWelcome = () => {
  useDocumentMeta({
    title: "Bienvenue — Mon Jeton",
    description: "Mon Jeton : tes dépenses en FCFA, ton budget et ton épargne, au même endroit.",
    path: "/bienvenue",
    noIndex: true,
  });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = Number(params.get("slide"));
  const [index, setIndex] = useState(requested >= 1 && requested <= STORIES.length ? requested - 1 : 0);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Le décor du bébé est téléchargé dès l'avant-dernier écran : pas d'attente.
  useEffect(() => {
    if (index >= STORIES.length - 2) loadBabyStage().catch(() => {});
  }, [index]);

  if (loading) return <EntryLoader />;
  // Déjà connecté : le parcours de bienvenue est terminé.
  if (user) return <Navigate to="/dashboard" replace />;
  // Déjà inscrit sur cet appareil puis déconnecté : droit à la connexion.
  if (!params.get("slide") && hasCompletedWelcome()) return <Navigate to="/login" replace />;

  const story = STORIES[index];
  const last = index === STORIES.length - 1;
  const goSlide = (i: number) => {
    setIndex(i);
    window.scrollTo({ top: 0 });
  };

  return (
    <EntryShell screen={`welcome-${index + 1}`}>
      <section
        key={index}
        className={`welcome story story-${index}`}
        onTouchStart={(e) => {
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          touch.current = null;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0 && !last) goSlide(index + 1);
            if (dx > 0 && index > 0) goSlide(index - 1);
          }
        }}
      >
        <figure className="welcome-visual">
          {story.photo ? (
            <img className="welcome-photo" src={story.photo} alt={story.alt} fetchPriority="high" />
          ) : (
            <Suspense fallback={<div className="baby-welcome-stage" role="img" aria-label={story.alt} />}>
              <BabyWelcomeStage />
            </Suspense>
          )}
          <div className="photo-shade" />
          <div className="welcome-nav">
            {index > 0 ? <Back onClick={() => goSlide(index - 1)} /> : <Brand />}
            <button className="skip-button" type="button" onClick={() => navigate("/signup")}>
              Passer <ArrowUpRight size={13} />
            </button>
          </div>
          <span className="story-location">
            {story.photo ? <MapPin size={11} /> : <Heart size={11} />}
            {story.place}
          </span>
        </figure>
        <div className="welcome-content">
          <blockquote className="story-quote">
            <p>{story.quote}</p>
          </blockquote>
          <div className="welcome-eyebrow">
            <span />
            {story.eyebrow}
          </div>
          <h1>
            {story.title}
            <br />
            <em>{story.emphasis}</em>
          </h1>
          <StoryFeature index={index} />
          <div className="welcome-bottom">
            <div className="slide-position">
              <div className="slide-dots" role="group" aria-label="Écrans de bienvenue">
                {STORIES.map((item, i) => (
                  <button
                    key={item.place}
                    type="button"
                    aria-label={`${item.place}, écran ${i + 1} sur ${STORIES.length}`}
                    aria-current={index === i ? "step" : undefined}
                    onClick={() => goSlide(i)}
                  />
                ))}
              </div>
              <span>
                0{index + 1} <span className="slash">/</span> 0{STORIES.length}
              </span>
            </div>
            <Primary onClick={() => (last ? navigate("/signup") : goSlide(index + 1))}>
              {last ? "Créer mon compte" : "Suivant"}
              <ArrowRight size={21} />
            </Primary>
            <button className="text-button login-link" type="button" onClick={() => navigate("/login")}>
              J'ai déjà un compte <span>Me connecter</span>
            </button>
          </div>
        </div>
      </section>
    </EntryShell>
  );
};

export default AppWelcome;
