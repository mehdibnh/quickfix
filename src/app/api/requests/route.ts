import mongoose from "mongoose";
import { getAuthenticatedUser, hasSameOrigin } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { ArtisanProfile } from "@/models/artisan-profile";
import { ServiceRequest } from "@/models/service-request";
import { User } from "@/models/user";

const requestStatuses = ["EN_ATTENTE", "ACCEPTEE", "EN_COURS", "TERMINEE", "REFUSEE", "ANNULEE"] as const;
type RequestStatus = (typeof requestStatuses)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Connectez-vous pour consulter vos demandes." }, { status: 401 });
    if (user.mustChangePassword) return Response.json({ error: "Changez votre mot de passe avant de continuer." }, { status: 403 });
    if (user.role !== "CLIENT" && user.role !== "ARTISAN") {
      return Response.json({ error: "Ce compte ne peut pas consulter les demandes." }, { status: 403 });
    }

    const ownRequests = await ServiceRequest.aggregate([
      { $match: user.role === "CLIENT" ? { clientId: user.id } : { artisanId: user.id } },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
      {
        $lookup: {
          from: User.collection.name,
          localField: "clientId",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1 } }],
          as: "client",
        },
      },
      {
        $lookup: {
          from: User.collection.name,
          localField: "artisanId",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1 } }],
          as: "artisan",
        },
      },
      { $unwind: "$client" },
      { $unwind: "$artisan" },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          clientId: { $toString: "$clientId" },
          artisanId: { $toString: "$artisanId" },
          clientName: "$client.name",
          artisanName: "$artisan.name",
          category: 1,
          description: 1,
          address: 1,
          scheduledAt: 1,
          status: 1,
          announcedPrice: { $ifNull: ["$announcedPrice", null] },
          statusHistory: 1,
          createdAt: 1,
        },
      },
    ]);

    return Response.json({ requests: ownRequests }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Chargement des demandes impossible :", error);
    return Response.json({ error: "Impossible de charger les demandes pour le moment." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Requête non autorisée." }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Connectez-vous pour demander une intervention." }, { status: 401 });
    if (user.mustChangePassword) return Response.json({ error: "Changez votre mot de passe avant de continuer." }, { status: 403 });
    if (user.role !== "CLIENT") {
      return Response.json({ error: "Seul un compte client peut créer une demande." }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Les informations envoyées sont invalides." }, { status: 400 });
    }
    if (!isRecord(body)) {
      return Response.json({ error: "Les informations envoyées sont invalides." }, { status: 400 });
    }

    const artisanId = typeof body.artisanId === "string" ? body.artisanId : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const scheduledAt = typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : new Date(Number.NaN);
    if (!mongoose.Types.ObjectId.isValid(artisanId)) {
      return Response.json({ error: "L’artisan sélectionné est invalide." }, { status: 400 });
    }
    if (description.length < 10 || description.length > 2000) {
      return Response.json({ error: "La description doit contenir entre 10 et 2 000 caractères." }, { status: 400 });
    }
    if (!address || address.length > 300) {
      return Response.json({ error: "L’adresse d’intervention est obligatoire (300 caractères maximum)." }, { status: 400 });
    }
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() || scheduledAt.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) {
      return Response.json({ error: "Choisissez une date future dans l’année à venir." }, { status: 400 });
    }

    const [profile, artisan] = await Promise.all([
      ArtisanProfile.findOne({ userId: artisanId, verificationStatus: "VERIFIED", isAvailable: true }).select("category"),
      User.findOne({ _id: artisanId, role: "ARTISAN", isSuspended: false }).select("name"),
    ]);
    if (!profile || !artisan) {
      return Response.json({ error: "Cet artisan n’est pas disponible pour les demandes." }, { status: 404 });
    }

    const serviceRequest = await ServiceRequest.create({
      clientId: user.id,
      artisanId,
      category: profile.category,
      description,
      address,
      scheduledAt,
      statusHistory: [{ status: "EN_ATTENTE", changedBy: user.id }],
    });

    return Response.json(
      {
        request: {
          id: serviceRequest.id,
          clientId: user.id.toString(),
          artisanId,
          clientName: user.name,
          artisanName: artisan.name,
          category: profile.category,
          description: serviceRequest.description,
          address: serviceRequest.address,
          scheduledAt: serviceRequest.scheduledAt,
          status: serviceRequest.status,
          announcedPrice: null,
          statusHistory: serviceRequest.statusHistory,
          createdAt: serviceRequest.createdAt,
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Création de demande impossible :", error);
    return Response.json({ error: "Impossible de créer la demande pour le moment." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Requête non autorisée." }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Connectez-vous pour modifier une demande." }, { status: 401 });
    if (user.mustChangePassword) return Response.json({ error: "Changez votre mot de passe avant de continuer." }, { status: 403 });
    if (user.role !== "CLIENT" && user.role !== "ARTISAN") {
      return Response.json({ error: "Ce compte ne peut pas modifier les demandes." }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Les informations envoyées sont invalides." }, { status: 400 });
    }
    if (!isRecord(body) || typeof body.id !== "string" || !mongoose.Types.ObjectId.isValid(body.id) || typeof body.status !== "string" || !requestStatuses.includes(body.status as RequestStatus)) {
      return Response.json({ error: "La demande ou son statut est invalide." }, { status: 400 });
    }

    const newStatus = body.status as RequestStatus;
    const ownership = user.role === "CLIENT" ? { clientId: user.id } : { artisanId: user.id };
    const allowedFrom: Partial<Record<RequestStatus, RequestStatus[]>> = user.role === "CLIENT"
      ? { ANNULEE: ["EN_ATTENTE", "ACCEPTEE"] }
      : {
          ACCEPTEE: ["EN_ATTENTE"],
          REFUSEE: ["EN_ATTENTE"],
          EN_COURS: ["ACCEPTEE"],
          TERMINEE: ["EN_COURS"],
        };
    const previousStatuses = allowedFrom[newStatus];
    if (!previousStatuses) {
      return Response.json({ error: "Ce changement de statut n’est pas autorisé pour votre rôle." }, { status: 403 });
    }

    const updated = await ServiceRequest.findOneAndUpdate(
      { _id: body.id, ...ownership, status: { $in: previousStatuses } },
      {
        $set: { status: newStatus },
        $push: { statusHistory: { status: newStatus, changedBy: user.id } },
      },
      { new: true, runValidators: true },
    ).select("_id status statusHistory");
    if (!updated) {
      const exists = await ServiceRequest.exists({ _id: body.id, ...ownership });
      return Response.json(
        { error: exists ? "La demande a déjà changé de statut ou cette action n’est plus possible." : "Demande introuvable." },
        { status: exists ? 409 : 404 },
      );
    }

    return Response.json({ id: updated.id, status: updated.status, statusHistory: updated.statusHistory }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Modification de demande impossible :", error);
    return Response.json({ error: "Impossible de modifier la demande pour le moment." }, { status: 503 });
  }
}
