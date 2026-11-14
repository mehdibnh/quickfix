"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppUser } from "@/components/auth-dialog";

type RequestStatus = "EN_ATTENTE" | "ACCEPTEE" | "EN_COURS" | "TERMINEE" | "REFUSEE" | "ANNULEE";

type ServiceRequestItem = {
  id: string;
  clientName: string;
  artisanName: string;
  category: string;
  description: string;
  address: string;
  scheduledAt: string;
  status: RequestStatus;
  announcedPrice: number | null;
};

const statusLabels: Record<RequestStatus, string> = {
  EN_ATTENTE: "En attente",
  ACCEPTEE: "Acceptée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  REFUSEE: "Refusée",
  ANNULEE: "Annulée",
};

type RequestsPanelProps = { user: AppUser; refreshKey: number };

export function RequestsPanel({ user, refreshKey }: RequestsPanelProps) {
  const [requests, setRequests] = useState<ServiceRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const loadRequests = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/requests", { signal, cache: "no-store" });
      const result: { requests?: ServiceRequestItem[]; error?: string } = await response.json();
      if (!response.ok || !result.requests) throw new Error(result.error ?? "Impossible de charger les demandes.");
      setRequests(result.requests);
    } catch (loadError) {
      if (signal?.aborted) return;
      console.error("Chargement des demandes impossible :", loadError);
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les demandes.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/requests", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result: { requests?: ServiceRequestItem[]; error?: string } = await response.json();
        if (!response.ok || !result.requests) throw new Error(result.error ?? "Impossible de charger les demandes.");
        setRequests(result.requests);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Chargement des demandes impossible :", loadError);
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les demandes.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  async function updateStatus(id: string, status: RequestStatus) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de mettre à jour la demande.");
      await loadRequests();
    } catch (updateError) {
      console.error("Mise à jour de la demande impossible :", updateError);
      setError(updateError instanceof Error ? updateError.message : "Impossible de mettre à jour la demande.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="requests-panel">
      <p className="eyebrow">{user.role === "ARTISAN" ? "ESPACE PROFESSIONNEL" : "VOTRE ESPACE CLIENT"}</p>
      <h1>{user.role === "ARTISAN" ? "Demandes reçues" : "Mes demandes"}</h1>
      <p className="requests-intro">{user.role === "ARTISAN" ? "Consultez les interventions proposées et mettez leur statut à jour." : "Suivez les réponses des artisans et l’avancement de vos interventions."}</p>
      {error && <p className="form-error" role="alert">{error}<button className="text-link" onClick={() => void loadRequests()}>Réessayer</button></p>}
      {loading ? <p role="status">Chargement des demandes…</p> : requests.length === 0 ? <div className="empty-state"><strong>Aucune demande pour le moment</strong><p>{user.role === "ARTISAN" ? "Les demandes qui vous sont adressées apparaîtront ici." : "Choisissez un artisan pour envoyer votre première demande."}</p></div> : (
        <div className="requests-list">{requests.map((item) => {
          const actions: { label: string; status: RequestStatus }[] = user.role === "ARTISAN"
            ? item.status === "EN_ATTENTE" ? [{ label: "Accepter", status: "ACCEPTEE" }, { label: "Refuser", status: "REFUSEE" }]
              : item.status === "ACCEPTEE" ? [{ label: "Démarrer", status: "EN_COURS" }]
                : item.status === "EN_COURS" ? [{ label: "Marquer terminée", status: "TERMINEE" }] : []
            : ["EN_ATTENTE", "ACCEPTEE"].includes(item.status) ? [{ label: "Annuler", status: "ANNULEE" }] : [];

          return (
            <article className="request-card" key={item.id}>
              <div className="request-card-heading"><div><p className="eyebrow">{item.category}</p><h2>{user.role === "ARTISAN" ? item.clientName : item.artisanName}</h2></div><span className={`request-status status-${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span></div>
              <p>{item.description}</p>
              <dl><div><dt>Intervention</dt><dd>{new Date(item.scheduledAt).toLocaleString("fr-FR")}</dd></div><div><dt>Adresse</dt><dd>{item.address}</dd></div>{item.announcedPrice !== null && <div><dt>Prix annoncé</dt><dd>{item.announcedPrice} DT</dd></div>}</dl>
              {actions.length > 0 && <div className="request-actions">{actions.map((action) => <button key={action.status} className={action.status === "REFUSEE" || action.status === "ANNULEE" ? "secondary-button" : "primary-button"} disabled={busyId === item.id} onClick={() => void updateStatus(item.id, action.status)}>{busyId === item.id ? "Patientez…" : action.label}</button>)}</div>}
            </article>
          );
        })}</div>
      )}
    </section>
  );
}
