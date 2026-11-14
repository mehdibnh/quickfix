"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminArtisansPanel } from "@/components/admin-artisans-panel";
import { AiAssistant } from "@/components/ai-assistant";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { AccountPanel } from "@/components/account-panel";
import { AuthDialog, type AppUser } from "@/components/auth-dialog";
import { RequestDialog } from "@/components/request-dialog";
import { RequestsPanel } from "@/components/requests-panel";

const categories = [
  { name: "Plomberie", icon: "⌁", color: "mint" },
  { name: "Électricité", icon: "ϟ", color: "lilac" },
  { name: "Climatisation", icon: "❋", color: "blue" },
  { name: "Peinture", icon: "◒", color: "peach" },
  { name: "Ménage", icon: "✳", color: "yellow" },
  { name: "Serrurerie", icon: "⌑", color: "pink" },
];

type Artisan = {
  id: string;
  name: string;
  city: string;
  job: string;
  rating: number | null;
  reviews: number;
  price: string;
  initials: string;
  tone: string;
  category: string;
  available: boolean;
  description: string;
};

type ArtisanListItem = {
  id: string;
  name: string;
  category: string;
  city: string;
  bio: string;
  isAvailable: boolean;
  indicativePriceMin: number | null;
  rating: number | null;
  reviews: number;
};

const artisanTones = ["sage", "lavender", "peach", "blue"];
type Tab = "Explorer" | "Mes demandes" | "Messages" | "Profil" | "Administration";

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const shared = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v12h14V9M9 21v-7h6v7" /></>,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5V3h6v2M9 11h6M9 15h6" /></>,
    chat: <><path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5Z" /><path d="M8 11h8M8 14h5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    verified: <><path d="m12 3 2.3 1.4 2.7.2 1.3 2.4 2.2 1.6-.4 2.7.4 2.7-2.2 1.6-1.3 2.4-2.7.2L12 20l-2.3-1.4-2.7-.2-1.3-2.4-2.2-1.6.4-2.7-.4-2.7 2.2-1.6L7 5l2.7-.2L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  };
  return <svg {...shared}>{paths[name]}</svg>;
}

export default function Home() {
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [artisansLoading, setArtisansLoading] = useState(true);
  const [artisansError, setArtisansError] = useState(false);
  const [reloadArtisans, setReloadArtisans] = useState(0);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authDialog, setAuthDialog] = useState<"login" | "register" | null>(null);
  const [requestTarget, setRequestTarget] = useState<Artisan | null>(null);
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);
  const [requestsVersion, setRequestsVersion] = useState(0);
  const [modalActionError, setModalActionError] = useState("");
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Explorer");
  const [activeCategory, setActiveCategory] = useState("Tout");
  const [search, setSearch] = useState("");
  const [selectedArtisan, setSelectedArtisan] = useState<Artisan | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortByRating, setSortByRating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Impossible de vérifier la session.");
        const result: { user: AppUser | null } = await response.json();
        setCurrentUser(result.user);
        if (result.user?.mustChangePassword) setActiveTab("Profil");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error("Vérification de session impossible :", error);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadArtisans() {
      setArtisansLoading(true);
      setArtisansError(false);

      try {
        const response = await fetch("/api/artisans", { signal: controller.signal });
        if (!response.ok) throw new Error("La liste des artisans n'a pas pu être chargée.");

        const data: { artisans: ArtisanListItem[] } = await response.json();
        setArtisans(data.artisans.map((artisan, index) => {
          const initials = artisan.name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0] ?? "")
            .join("")
            .toUpperCase();

          return {
            id: artisan.id,
            name: artisan.name,
            city: artisan.city,
            job: `${artisan.category} · ${artisan.city}`,
            rating: artisan.rating,
            reviews: artisan.reviews,
            price: artisan.indicativePriceMin === null ? "Sur devis" : `À partir de ${artisan.indicativePriceMin} DT`,
            initials,
            tone: artisanTones[index % artisanTones.length],
            category: artisan.category,
            available: artisan.isAvailable,
            description: artisan.bio || "Aucune présentation disponible.",
          };
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Chargement des artisans impossible :", error);
        setArtisansError(true);
      } finally {
        if (!controller.signal.aborted) setArtisansLoading(false);
      }
    }

    void loadArtisans();
    return () => controller.abort();
  }, [reloadArtisans]);

  const visibleArtisans = useMemo(() => artisans.filter((artisan) => {
    const matchesCategory = activeCategory === "Tout" ||
      artisan.category.toLocaleLowerCase("fr") === activeCategory.toLocaleLowerCase("fr");
    const term = search.trim().toLowerCase();
    return matchesCategory &&
      (!availableOnly || artisan.available) &&
      (!term || `${artisan.name} ${artisan.job} ${artisan.category} ${artisan.city ?? ""}`.toLowerCase().includes(term));
  }).sort((left, right) => sortByRating ? (right.rating ?? 0) - (left.rating ?? 0) : 0), [activeCategory, artisans, availableOnly, search, sortByRating]);

  function openArtisan(artisan: Artisan) {
    setModalActionError("");
    setSelectedArtisan(artisan);
  }

  function selectTab(tab: Tab) {
    if (currentUser?.mustChangePassword) {
      setActiveTab("Profil");
      return;
    }
    if (tab === "Administration" && currentUser?.role !== "ADMIN") return;
    if ((tab === "Mes demandes" || tab === "Profil") && !currentUser) {
      setPendingTab(tab);
      setAuthDialog("login");
      return;
    }
    setActiveTab(tab);
  }

  function finishAuthentication(user: AppUser) {
    setCurrentUser(user);
    setAuthDialog(null);
    if (user.mustChangePassword) {
      setActiveTab("Profil");
      setPendingTab(null);
      return;
    }
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
    if (selectedArtisan && user.role === "CLIENT") setRequestTarget(selectedArtisan);
  }

  async function logout() {
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Impossible de fermer la session.");
      setCurrentUser(null);
      setActiveTab("Explorer");
    } catch (error) {
      console.error("Déconnexion impossible :", error);
    }
  }

  const navigationTabs: Tab[] = currentUser?.role === "ADMIN"
    ? ["Explorer", "Mes demandes", "Messages", "Profil", "Administration"]
    : ["Explorer", "Mes demandes", "Messages", "Profil"];

  return (
    <main className="app-shell">
      <aside className="desktop-sidebar">
        <a className="brand" href="#" onClick={() => setActiveTab("Explorer")} aria-label="QuickFix, accueil">
          <span className="brand-mark">q<span>.</span></span><span>quickfix</span>
        </a>
        <span className="sidebar-label">MENU</span>
        <nav className="side-nav" aria-label="Navigation principale">
          {navigationTabs.map((tab) => (
            <button key={tab} className={activeTab === tab ? "side-link active" : "side-link"} onClick={() => selectTab(tab)}>
              <Icon name={{ Explorer: "home", "Mes demandes": "clipboard", Messages: "chat", Profil: "user", Administration: "verified" }[tab]} size={19} />
              <span>{tab}</span>
              {tab === "Messages" && <span className="unread-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-help">
          <span className="help-spark">✳</span>
          <strong>Besoin d&apos;aide ?</strong>
          <p>Notre équipe est là pour vous accompagner.</p>
          <button onClick={() => setActiveTab("Messages")}>Contacter le support <Icon name="arrow" size={15} /></button>
        </div>
        <button className="profile-mini" onClick={() => currentUser ? selectTab("Profil") : setAuthDialog("login")}>
        <span className="avatar avatar-small sage">{currentUser?.name.slice(0, 1).toUpperCase() ?? "?"}</span><span><strong>{currentUser?.name ?? "Visiteur"}</strong><small>{currentUser ? `Compte ${currentUser.role === "ARTISAN" ? "artisan" : currentUser.role === "ADMIN" ? "administrateur" : "client"}` : "Se connecter"}</small></span><span className="profile-dots">···</span>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-brand brand" onClick={() => setActiveTab("Explorer")}><span className="brand-mark">q<span>.</span></span><span>quickfix</span></button>
          <div className="location"><Icon name="pin" size={17} /><span><small>VOTRE LOCALISATION</small><strong>Tunis, Tunisie</strong></span><span className="chevron">⌄</span></div>
          <div className="topbar-actions">
            {currentUser ? <><span className="user-greeting">{currentUser.name}</span><button className="auth-top-button" onClick={() => void logout()}>Déconnexion</button></> : <><button className="auth-top-button" onClick={() => setAuthDialog("login")}>Connexion</button><button className="auth-top-button auth-top-primary" onClick={() => setAuthDialog("register")}>Inscription</button></>}
          </div>
        </header>

        <div className="content">
          {activeTab === "Explorer" ? (
            <>
              <section className="welcome-row">
                <div><p className="eyebrow">VOTRE ESPACE CLIENT</p><h1>Bienvenue <span className="wave">✳</span></h1><p className="welcome-subtitle">Un petit souci à la maison ? On s&apos;en occupe.</p></div>
                <PwaInstallButton />
              </section>

              <section className="hero-card">
                <div className="hero-content">
                  <span className="hero-kicker"><span className="live-dot" /> DES ARTISANS DE CONFIANCE</span>
                  <h2>Votre maison<br />entre de <em>bonnes mains.</em></h2>
                  <p>Trouvez le bon professionnel près de chez vous, en quelques instants.</p>
                  <button className="hero-cta" onClick={() => document.getElementById("artisan-search")?.focus()}>Trouver un artisan <Icon name="arrow" size={17} /></button>
                </div>
                <div className="hero-illustration" aria-hidden="true">
                  <div className="sun-shape" /><div className="house-shape"><div className="roof-shape" /><div className="house-wall"><div className="window-shape" /><div className="door-shape" /></div></div><div className="hero-plant"><i /><i /><i /><b /></div>
                  <span className="float-badge"><Icon name="verified" size={16} /> Vérifié</span>
                </div>
                <span className="hero-number">01 — 03</span>
              </section>

              <button className="ai-entry" onClick={() => setAiAssistantOpen(true)}>
                <span className="ai-entry-icon">✳</span>
                <span><strong>Pas sûr du métier à choisir ?</strong><small>Décrivez votre problème à notre assistant IA.</small></span>
                <Icon name="arrow" size={18} />
              </button>

              <section className="search-section" aria-label="Recherche d'artisans">
                <div className="search-field"><Icon name="search" size={20} /><input id="artisan-search" type="search" placeholder="Quel service recherchez-vous ?" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></div>
                <button className="filter-button" aria-expanded={filtersOpen} aria-label="Filtrer la recherche" onClick={() => setFiltersOpen(!filtersOpen)}><span className="filter-bars">☷</span><span>Filtres</span><i>{Number(availableOnly) + Number(sortByRating)}</i></button>
              </section>
              {filtersOpen && <section className="filter-panel" aria-label="Options de filtrage">
                <label><input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} /> Disponible maintenant</label>
                <label><input type="checkbox" checked={sortByRating} onChange={(event) => setSortByRating(event.target.checked)} /> Trier par meilleure note</label>
                <button onClick={() => { setAvailableOnly(false); setSortByRating(false); }}>Réinitialiser</button>
              </section>}

              <section className="category-section">
                <div className="section-heading"><div><p className="eyebrow">NOS EXPERTISES</p><h2>De quoi avez-vous besoin ?</h2></div><button className="text-link" onClick={() => setActiveCategory("Tout")}>Tout voir <Icon name="arrow" size={15} /></button></div>
                <div className="category-grid">
                  {categories.map((category) => <button key={category.name} onClick={() => setActiveCategory(activeCategory === category.name ? "Tout" : category.name)} className={`category-card ${category.color} ${activeCategory === category.name ? "selected" : ""}`}><span className="category-icon">{category.icon}</span><span>{category.name}</span></button>)}
                </div>
              </section>

              <section className="artisans-section" id="artisans-section">
                <div className="section-heading"><div><p className="eyebrow">LES MIEUX NOTÉS PRÈS DE CHEZ VOUS</p><h2>Artisans recommandés <span className="heading-spark">✳</span></h2></div><button className="text-link" onClick={() => setActiveCategory("Tout")}>Voir tout <Icon name="arrow" size={15} /></button></div>
                <div className="category-pills">
                  {["Tout", ...categories.map((category) => category.name)].map((category) => <button key={category} className={activeCategory === category ? "pill active" : "pill"} onClick={() => setActiveCategory(category)}>{category}</button>)}
                </div>
                <div className="artisan-grid">
                  {artisansError ? <div className="empty-state" role="alert"><strong>Impossible de charger les artisans</strong><p>Vérifiez votre connexion et réessayez.</p><button className="text-link" onClick={() => setReloadArtisans((count) => count + 1)}>Réessayer</button></div> : artisansLoading ? <div className="empty-state" role="status"><strong>Chargement des artisans…</strong></div> : visibleArtisans.length ? visibleArtisans.map((artisan) => <article key={artisan.id} className="artisan-card">
                    <button className="artisan-main" onClick={() => openArtisan(artisan)} aria-label={`Voir le profil de ${artisan.name}`}>
                      <span className={`avatar artisan-avatar ${artisan.tone}`}>{artisan.initials}</span>
                      <span className="artisan-info"><strong>{artisan.name} <Icon name="verified" size={15} /></strong><small>{artisan.job}</small>{artisan.rating === null ? <span className="rating">Nouvel artisan</span> : <span className="rating"><Icon name="star" size={14} /> {artisan.rating.toFixed(1)} <span>({artisan.reviews} avis)</span></span>}</span>
                      <span className={`availability ${artisan.available ? "" : "busy"}`}><i />{artisan.available ? "Disponible" : "Occupé"}</span>
                    </button>
                    <div className="artisan-card-footer"><span>{artisan.price}</span><button aria-label={`Demander un devis à ${artisan.name}`} onClick={() => openArtisan(artisan)}><Icon name="arrow" size={17} /></button></div>
                  </article>) : <div className="empty-state"><span>⌕</span><strong>Aucun artisan trouvé</strong><p>Essayez un autre service ou une autre recherche.</p><button className="text-link" onClick={() => { setSearch(""); setActiveCategory("Tout"); }}>Effacer les filtres</button></div>}
                </div>
              </section>

              <section className="trust-strip"><span className="trust-icon"><Icon name="verified" size={19} /></span><span><strong>Des professionnels vérifiés, pour de vrai.</strong><small>Chaque profil est contrôlé par notre équipe avant d&apos;être publié.</small></span><Icon name="arrow" size={17} /></section>
            </>
          ) : activeTab === "Mes demandes" && currentUser ? (
            <RequestsPanel user={currentUser} refreshKey={requestsVersion} />
          ) : activeTab === "Profil" && currentUser ? (
            <AccountPanel user={currentUser} onPasswordChanged={() => setCurrentUser({ ...currentUser, mustChangePassword: false })} />
          ) : activeTab === "Administration" && currentUser?.role === "ADMIN" ? (
            <AdminArtisansPanel />
          ) : (
            <section className="tab-placeholder">
              <span className="placeholder-icon"><Icon name={{ Explorer: "home", "Mes demandes": "clipboard", Messages: "chat", Profil: "user", Administration: "verified" }[activeTab]} size={27} /></span>
              <p className="eyebrow">VOTRE ESPACE QUICKFIX</p>
              <h1>{activeTab}</h1>
              <p>{activeTab === "Mes demandes" ? "Retrouvez ici le suivi de vos demandes d'intervention." : activeTab === "Messages" ? "Vos échanges avec les artisans apparaîtront ici." : "Gérez vos informations et préférences."}</p>
              <button className="primary-button" onClick={() => selectTab("Explorer")}>Explorer les artisans <Icon name="arrow" size={17} /></button>
            </section>
          )}
        </div>

        <nav className="bottom-nav" aria-label="Navigation mobile">
          {navigationTabs.map((tab) => <button key={tab} className={activeTab === tab ? "bottom-link active" : "bottom-link"} onClick={() => selectTab(tab)}><span className="bottom-icon"><Icon name={{ Explorer: "home", "Mes demandes": "clipboard", Messages: "chat", Profil: "user", Administration: "verified" }[tab]} size={20} />{tab === "Messages" && <i />}</span><span>{tab === "Mes demandes" ? "Demandes" : tab}</span></button>)}
        </nav>
      </section>

      {selectedArtisan && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedArtisan(null); }}>
        <section className="artisan-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button className="modal-close" onClick={() => setSelectedArtisan(null)} aria-label="Fermer"><Icon name="close" /></button>
          <div className="modal-profile"><span className={`avatar modal-avatar ${selectedArtisan.tone}`}>{selectedArtisan.initials}</span><span className={`availability ${selectedArtisan.available ? "" : "busy"}`}><i />{selectedArtisan.available ? "Disponible aujourd'hui" : "Indisponible actuellement"}</span></div>
          <h2 id="modal-title">{selectedArtisan.name} <Icon name="verified" size={18} /></h2><p className="modal-job">{selectedArtisan.job}</p><div className="modal-rating">{selectedArtisan.rating === null ? "Aucun avis pour le moment" : <><Icon name="star" size={15} /> {selectedArtisan.rating.toFixed(1)} <span>({selectedArtisan.reviews} avis vérifiés)</span></>}</div>
          <p className="modal-description">{selectedArtisan.description}</p>
          <div className="modal-price"><span>Tarif indicatif</span><strong>{selectedArtisan.price.replace("À partir de ", "")}</strong></div>
          <button className="primary-button modal-cta" disabled={!selectedArtisan.available} onClick={() => {
            if (!currentUser) setAuthDialog("login");
            else if (currentUser.role === "CLIENT") setRequestTarget(selectedArtisan);
            else setModalActionError("Connectez-vous avec un compte client pour envoyer une demande.");
          }}>{selectedArtisan.available ? "Demander une intervention" : "Artisan indisponible"}</button>
          {modalActionError && <p className="form-error" role="alert">{modalActionError}</p>}
          <small className="modal-note"><Icon name="clock" size={14} /> Votre adresse ne sera communiquée qu’à l’artisan choisi.</small>
        </section>
      </div>}
      {authDialog && <AuthDialog initialMode={authDialog} onClose={() => { setAuthDialog(null); setPendingTab(null); }} onSuccess={finishAuthentication} />}
      {aiAssistantOpen && <AiAssistant onClose={() => setAiAssistantOpen(false)} onSelectCategory={(category) => {
        setActiveCategory(category);
        setAiAssistantOpen(false);
        window.setTimeout(() => document.getElementById("artisans-section")?.scrollIntoView({ behavior: "smooth" }), 0);
      }} />}
      {requestTarget && <RequestDialog artisan={{ id: requestTarget.id, name: requestTarget.name, category: requestTarget.category }} onClose={() => setRequestTarget(null)} onCreated={() => {
        setRequestTarget(null);
        setSelectedArtisan(null);
        setActiveTab("Mes demandes");
        setRequestsVersion((version) => version + 1);
      }} />}
    </main>
  );
}
