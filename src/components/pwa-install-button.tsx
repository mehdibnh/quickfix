"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

function subscribeInstallStatus(onChange: () => void) {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    displayMode.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function isAppInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true);
}

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "other">("other");
  const installed = useSyncExternalStore(subscribeInstallStatus, isAppInstalled, () => true);

  useEffect(() => {
    function handleInstallPrompt(event: BeforeInstallPromptEvent) {
      event.preventDefault();
      setInstallPrompt(event);
    }
    function handleInstalled() {
      setInstallPrompt(null);
      setHelpOpen(false);
    }

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installed) return null;

  function showInstructions() {
    setPlatform(/iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios" : "other");
    setHelpOpen(true);
  }

  async function startInstall() {
    if (!installPrompt) {
      showInstructions();
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome !== "accepted") showInstructions();
    } catch (error) {
      console.error("Installation de QuickFix impossible :", error);
      showInstructions();
    }
  }

  return (
    <>
      <button className="pwa-install-button" onClick={() => void startInstall()}>
        <span aria-hidden="true">↓</span> Installer l’app
      </button>
      {helpOpen && (
        <div className="modal-backdrop pwa-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
          <section className="artisan-modal pwa-help" role="dialog" aria-modal="true" aria-labelledby="pwa-title">
            <button className="modal-close" onClick={() => setHelpOpen(false)} aria-label="Fermer">×</button>
            <p className="eyebrow">QUICKFIX SUR VOTRE TÉLÉPHONE</p>
            <h2 id="pwa-title">Ajouter QuickFix à l’écran d’accueil</h2>
            {platform === "ios" ? (
              <ol>
                <li>Ouvrez cette page dans <strong>Safari</strong>.</li>
                <li>Appuyez sur le bouton <strong>Partager</strong> (le carré avec la flèche vers le haut).</li>
                <li>Choisissez <strong>Sur l’écran d’accueil</strong>, puis appuyez sur <strong>Ajouter</strong>.</li>
              </ol>
            ) : (
              <ol>
                <li>Dans le menu de votre navigateur (⋮), choisissez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</li>
                <li>Confirmez l’installation. L’icône QuickFix apparaîtra sur votre écran d’accueil.</li>
              </ol>
            )}
            <p className="form-hint">L’installation est disponible lorsque le site est hébergé en HTTPS. Sur iPhone et iPad, utilisez Safari.</p>
            <button className="primary-button" onClick={() => setHelpOpen(false)}>Compris</button>
          </section>
        </div>
      )}
    </>
  );
}
