"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        await Promise.all(
          registrations
            .filter((registration) =>
              [registration.active, registration.waiting, registration.installing]
                .some((worker) => worker?.scriptURL === `${window.location.origin}/sw.js`),
            )
            .map((registration) => registration.unregister()),
        );
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((name) => name.startsWith("quickfix-shell-"))
            .map((name) => caches.delete(name)),
        );
      }).catch((error: unknown) => {
        console.error("Nettoyage du service worker de développement impossible :", error);
      });
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch((error: unknown) => {
      console.error("Enregistrement du service worker impossible :", error);
    });
  }, []);

  return null;
}
