import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { getAuthenticatedUser, hasSameOrigin } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { hashPassword } from "@/lib/password";
import { ArtisanProfile } from "@/models/artisan-profile";
import { User } from "@/models/user";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const admin = await getAuthenticatedUser(request);
    if (!admin) return Response.json({ error: "Connectez-vous pour accéder à l’administration." }, { status: 401 });
    if (admin.mustChangePassword) return Response.json({ error: "Changez votre mot de passe avant de continuer." }, { status: 403 });
    if (admin.role !== "ADMIN") return Response.json({ error: "Accès réservé à l’administration." }, { status: 403 });

    const view = new URL(request.url).searchParams.get("view");
    const match = view === "all" ? {} : { verificationStatus: "PENDING" };
    const artisans = await ArtisanProfile.aggregate([
      { $match: match },
      { $sort: { createdAt: 1 } },
      { $limit: 100 },
      {
        $lookup: {
          from: User.collection.name,
          let: { userId: "$userId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$userId"] },
                    { $eq: ["$role", "ARTISAN"] },
                  ],
                },
              },
            },
            { $project: { name: 1, email: 1, phone: 1, isSuspended: 1 } },
          ],
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          name: "$user.name",
          email: "$user.email",
          phone: { $ifNull: ["$user.phone", ""] },
          isSuspended: "$user.isSuspended",
          verificationStatus: 1,
          isAvailable: 1,
          category: 1,
          city: 1,
          bio: 1,
          indicativePriceMin: { $ifNull: ["$indicativePriceMin", null] },
          indicativePriceMax: { $ifNull: ["$indicativePriceMax", null] },
          createdAt: 1,
        },
      },
    ]);

    return Response.json({ artisans }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Chargement de la file de vérification impossible :", error);
    return Response.json({ error: "Impossible de charger les profils à vérifier." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: "Requête non autorisée." }, { status: 403 });

  try {
    await connectToDatabase();
    const admin = await getAuthenticatedUser(request);
    if (!admin) return Response.json({ error: "Connectez-vous pour accéder à l’administration." }, { status: 401 });
    if (admin.mustChangePassword) return Response.json({ error: "Changez votre mot de passe avant de continuer." }, { status: 403 });
    if (admin.role !== "ADMIN") return Response.json({ error: "Accès réservé à l’administration." }, { status: 403 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Les informations envoyées sont invalides." }, { status: 400 });
    }
    if (!isRecord(body)) return Response.json({ error: "Les informations envoyées sont invalides." }, { status: 400 });

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const bio = typeof body.bio === "string" ? body.bio.trim() : "";
    const priceMin = body.indicativePriceMin === "" || body.indicativePriceMin == null ? undefined : Number(body.indicativePriceMin);
    const priceMax = body.indicativePriceMax === "" || body.indicativePriceMax == null ? undefined : Number(body.indicativePriceMax);

    if (name.length < 2 || name.length > 100) return Response.json({ error: "Le nom doit contenir entre 2 et 100 caractères." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return Response.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    if (phone.length > 30 || category.length < 2 || category.length > 80 || city.length < 2 || city.length > 80 || bio.length > 1200) {
      return Response.json({ error: "Vérifiez le téléphone, le métier, la ville et la présentation." }, { status: 400 });
    }
    if (
      (priceMin !== undefined && (!Number.isFinite(priceMin) || priceMin < 0)) ||
      (priceMax !== undefined && (!Number.isFinite(priceMax) || priceMax < 0)) ||
      (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax)
    ) {
      return Response.json({ error: "La fourchette de prix est invalide." }, { status: 400 });
    }

    const temporaryPassword = randomBytes(18).toString("base64url");
    const dbSession = await mongoose.startSession();
    let artisanId = "";
    try {
      await dbSession.withTransaction(async () => {
        const [user] = await User.create([{
          name,
          email,
          phone,
          role: "ARTISAN",
          passwordHash: await hashPassword(temporaryPassword),
          mustChangePassword: true,
        }], { session: dbSession });
        artisanId = user.id;
        await ArtisanProfile.create([{
          userId: user._id,
          category,
          city,
          bio,
          indicativePriceMin: priceMin,
          indicativePriceMax: priceMax,
          verificationStatus: "PENDING",
        }], { session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    return Response.json({
      artisan: { id: artisanId, name, email, category, city, verificationStatus: "PENDING" },
      temporaryPassword,
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isRecord(error) && error.code === 11000) {
      return Response.json({ error: "Un compte utilise déjà cette adresse e-mail." }, { status: 409 });
    }
    console.error("Création d’un artisan impossible :", error);
    return Response.json({ error: "Impossible de créer le compte artisan." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Requête non autorisée." }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const admin = await getAuthenticatedUser(request);
    if (!admin) return Response.json({ error: "Connectez-vous pour accéder à l’administration." }, { status: 401 });
    if (admin.mustChangePassword) return Response.json({ error: "Changez votre mot de passe avant de continuer." }, { status: 403 });
    if (admin.role !== "ADMIN") return Response.json({ error: "Accès réservé à l’administration." }, { status: 403 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Les informations envoyées sont invalides." }, { status: 400 });
    }

    if (isRecord(body) && body.action === "edit") {
      if (typeof body.profileId !== "string" || !mongoose.Types.ObjectId.isValid(body.profileId)) {
        return Response.json({ error: "Le profil sélectionné est invalide." }, { status: 400 });
      }

      const name = typeof body.name === "string" ? body.name.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";
      const category = typeof body.category === "string" ? body.category.trim() : "";
      const city = typeof body.city === "string" ? body.city.trim() : "";
      const bio = typeof body.bio === "string" ? body.bio.trim() : "";
      const priceMin = body.indicativePriceMin === "" || body.indicativePriceMin == null ? undefined : Number(body.indicativePriceMin);
      const priceMax = body.indicativePriceMax === "" || body.indicativePriceMax == null ? undefined : Number(body.indicativePriceMax);

      if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return Response.json({ error: "Vérifiez le nom et l’adresse e-mail." }, { status: 400 });
      }
      if (phone.length > 30 || category.length < 2 || category.length > 80 || city.length < 2 || city.length > 80 || bio.length > 1200) {
        return Response.json({ error: "Vérifiez le téléphone, le métier, la ville et la présentation." }, { status: 400 });
      }
      if (
        (priceMin !== undefined && (!Number.isFinite(priceMin) || priceMin < 0)) ||
        (priceMax !== undefined && (!Number.isFinite(priceMax) || priceMax < 0)) ||
        (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) ||
        typeof body.isAvailable !== "boolean" ||
        typeof body.isSuspended !== "boolean"
      ) {
        return Response.json({ error: "Vérifiez les tarifs et les options du compte." }, { status: 400 });
      }

      const dbSession = await mongoose.startSession();
      const updateResult: { error: "profile" | "user" | null } = { error: null };
      try {
        await dbSession.withTransaction(async () => {
          const profile = await ArtisanProfile.findById(body.profileId).session(dbSession);
          if (!profile) {
            updateResult.error = "profile";
            return;
          }
          const user = await User.findOne({ _id: profile.userId, role: "ARTISAN" }).session(dbSession);
          if (!user) {
            updateResult.error = "user";
            return;
          }

          user.name = name;
          user.email = email;
          user.phone = phone;
          user.isSuspended = body.isSuspended;
          user.suspensionReason = body.isSuspended ? "Désactivé par l’administration" : "";
          profile.category = category;
          profile.city = city;
          profile.bio = bio;
          profile.indicativePriceMin = priceMin;
          profile.indicativePriceMax = priceMax;
          profile.isAvailable = body.isSuspended ? false : body.isAvailable;

          await user.save({ session: dbSession });
          await profile.save({ session: dbSession });
        });
      } catch (error) {
        if (isRecord(error) && error.code === 11000) {
          return Response.json({ error: "Un autre compte utilise déjà cette adresse e-mail." }, { status: 409 });
        }
        throw error;
      } finally {
        await dbSession.endSession();
      }

      if (updateResult.error === "profile") return Response.json({ error: "Profil artisan introuvable." }, { status: 404 });
      if (updateResult.error === "user") return Response.json({ error: "Compte artisan introuvable." }, { status: 404 });
      return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
    }

    if (
      !isRecord(body) ||
      typeof body.profileId !== "string" ||
      !mongoose.Types.ObjectId.isValid(body.profileId) ||
      (body.status !== "VERIFIED" && body.status !== "REJECTED")
    ) {
      return Response.json({ error: "Le profil ou la décision est invalide." }, { status: 400 });
    }

    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (body.status === "REJECTED" && (reason.length < 5 || reason.length > 500)) {
      return Response.json({ error: "Indiquez un motif de refus (5 à 500 caractères)." }, { status: 400 });
    }

    const pendingProfile = await ArtisanProfile.findOne({ _id: body.profileId, verificationStatus: "PENDING" }).select("userId");
    if (!pendingProfile) {
      return Response.json({ error: "Ce profil est introuvable ou a déjà été traité." }, { status: 409 });
    }
    if (body.status === "VERIFIED" && await User.exists({ _id: pendingProfile.userId, isSuspended: true })) {
      return Response.json({ error: "Un compte suspendu ne peut pas être approuvé." }, { status: 409 });
    }

    const profile = await ArtisanProfile.findOneAndUpdate(
      { _id: body.profileId, verificationStatus: "PENDING" },
      {
        $set: {
          verificationStatus: body.status,
          verificationReason: body.status === "REJECTED" ? reason : "",
          verifiedBy: admin.id,
          verifiedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    ).select("_id verificationStatus verificationReason verifiedAt");

    if (!profile) {
      return Response.json({ error: "Ce profil est introuvable ou a déjà été traité." }, { status: 409 });
    }

    return Response.json({
      profile: {
        id: profile.id,
        status: profile.verificationStatus,
        reason: profile.verificationReason,
        verifiedAt: profile.verifiedAt,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Décision de vérification impossible :", error);
    return Response.json({ error: "Impossible d’enregistrer la décision." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: "Requête non autorisée." }, { status: 403 });

  try {
    await connectToDatabase();
    const admin = await getAuthenticatedUser(request);
    if (!admin) return Response.json({ error: "Connectez-vous pour accéder à l’administration." }, { status: 401 });
    if (admin.mustChangePassword) return Response.json({ error: "Changez votre mot de passe avant de continuer." }, { status: 403 });
    if (admin.role !== "ADMIN") return Response.json({ error: "Accès réservé à l’administration." }, { status: 403 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Les informations envoyées sont invalides." }, { status: 400 });
    }
    if (!isRecord(body) || typeof body.profileId !== "string" || !mongoose.Types.ObjectId.isValid(body.profileId)) {
      return Response.json({ error: "Le profil sélectionné est invalide." }, { status: 400 });
    }

    const dbSession = await mongoose.startSession();
    const deactivationResult: { error: "profile" | "user" | "already-suspended" | null } = { error: null };
    try {
      await dbSession.withTransaction(async () => {
        const profile = await ArtisanProfile.findById(body.profileId).session(dbSession);
        if (!profile) {
          deactivationResult.error = "profile";
          return;
        }
        const user = await User.findOne({ _id: profile.userId, role: "ARTISAN" }).session(dbSession);
        if (!user) {
          deactivationResult.error = "user";
          return;
        }
        if (user.isSuspended) {
          deactivationResult.error = "already-suspended";
          return;
        }

        user.isSuspended = true;
        user.suspensionReason = "Désactivé par l’administration";
        profile.isAvailable = false;
        await user.save({ session: dbSession });
        await profile.save({ session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    if (deactivationResult.error === "profile") return Response.json({ error: "Profil artisan introuvable." }, { status: 404 });
    if (deactivationResult.error === "user") return Response.json({ error: "Compte artisan introuvable." }, { status: 404 });
    if (deactivationResult.error === "already-suspended") return Response.json({ error: "Ce compte est déjà désactivé." }, { status: 409 });

    return Response.json({ success: true, deactivated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Désactivation du compte artisan impossible :", error);
    return Response.json({ error: "Impossible de désactiver le compte." }, { status: 503 });
  }
}
