import { connectToDatabase } from "@/lib/mongodb";
import { createSession, hasSameOrigin, sessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { User } from "@/models/user";

const INVALID_ACCOUNT_HASH = `scrypt$16384$8$1$${"0".repeat(32)}$${"0".repeat(128)}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Requête non autorisée." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Les informations envoyées sont invalides." }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.email !== "string" || typeof body.password !== "string") {
    return Response.json({ error: "Adresse e-mail ou mot de passe incorrect." }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  const password = body.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length > 128) {
    return Response.json({ error: "Adresse e-mail ou mot de passe incorrect." }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const user = await User.findOne({ email }).select("+passwordHash");
    const passwordMatches = await verifyPassword(password, user?.passwordHash ?? INVALID_ACCOUNT_HASH);
    if (!user || !passwordMatches) {
      return Response.json({ error: "Adresse e-mail ou mot de passe incorrect." }, { status: 401 });
    }
    if (user.isSuspended) {
      return Response.json({ error: "Ce compte est suspendu. Contactez l’assistance." }, { status: 403 });
    }

    const token = await createSession(user._id);
    return Response.json(
      { user: { id: user.id, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword } },
      { headers: { "Set-Cookie": sessionCookie(token), "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Connexion impossible :", error);
    return Response.json({ error: "Impossible de vous connecter pour le moment." }, { status: 503 });
  }
}
