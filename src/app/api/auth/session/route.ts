import { createSession, getAuthenticatedUser, hasSameOrigin, revokeSession, sessionCookie } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { hashPassword, verifyPassword } from "@/lib/password";
import { Session } from "@/models/session";
import { User } from "@/models/user";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const user = await getAuthenticatedUser(request);
    return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Lecture de la session impossible :", error);
    return Response.json({ error: "Impossible de vérifier la session." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Requête non autorisée." }, { status: 403 });
  }

  try {
    await connectToDatabase();
    await revokeSession(request);
    return Response.json({ success: true }, { headers: { "Set-Cookie": sessionCookie("", 0), "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Déconnexion impossible :", error);
    return Response.json({ error: "Impossible de fermer la session." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Requête non autorisée." }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Connectez-vous pour changer le mot de passe." }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Les informations envoyées sont invalides." }, { status: 400 });
    }
    if (
      !isRecord(body) ||
      typeof body.currentPassword !== "string" ||
      body.currentPassword.length > 128 ||
      Buffer.byteLength(body.currentPassword, "utf8") > 256 ||
      typeof body.newPassword !== "string"
    ) {
      return Response.json({ error: "Renseignez votre mot de passe actuel et le nouveau." }, { status: 400 });
    }
    if (
      body.newPassword.length < 12 ||
      body.newPassword.length > 128 ||
      Buffer.byteLength(body.newPassword, "utf8") > 256
    ) {
      return Response.json({ error: "Le nouveau mot de passe doit contenir entre 12 et 128 caractères." }, { status: 400 });
    }

    const account = await User.findById(user.id).select("+passwordHash");
    if (!account || !(await verifyPassword(body.currentPassword, account.passwordHash))) {
      return Response.json({ error: "Le mot de passe actuel est incorrect." }, { status: 400 });
    }

    account.passwordHash = await hashPassword(body.newPassword);
    account.mustChangePassword = false;
    await account.save();
    await Session.deleteMany({ userId: user.id });
    const token = await createSession(user.id);
    return Response.json(
      { success: true },
      { headers: { "Set-Cookie": sessionCookie(token), "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Changement de mot de passe impossible :", error);
    return Response.json({ error: "Impossible de changer le mot de passe pour le moment." }, { status: 503 });
  }
}
