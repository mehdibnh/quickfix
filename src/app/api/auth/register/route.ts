import { connectToDatabase } from "@/lib/mongodb";
import { createSession, hasSameOrigin, sessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { User } from "@/models/user";

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
  if (!isRecord(body)) {
    return Response.json({ error: "Les informations envoyées sont invalides." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (name.length < 2 || name.length > 100) {
    return Response.json({ error: "Le nom doit contenir entre 2 et 100 caractères." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return Response.json({ error: "L'adresse e-mail n'est pas valide." }, { status: 400 });
  }
  if (password.length < 12 || password.length > 128 || Buffer.byteLength(password, "utf8") > 256) {
    return Response.json({ error: "Le mot de passe doit contenir entre 12 et 128 caractères." }, { status: 400 });
  }
  if (phone.length > 30) {
    return Response.json({ error: "Le numéro de téléphone est trop long." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const user = await User.create({
      name,
      email,
      phone,
      passwordHash: await hashPassword(password),
      role: "CLIENT",
      mustChangePassword: false,
    });
    const token = await createSession(user._id);
    return Response.json(
      { user: { id: user.id, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword } },
      { status: 201, headers: { "Set-Cookie": sessionCookie(token), "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (isRecord(error) && error.code === 11000) {
      return Response.json({ error: "Un compte utilise déjà cette adresse e-mail." }, { status: 409 });
    }
    console.error("Inscription impossible :", error);
    return Response.json({ error: "Impossible de créer le compte pour le moment." }, { status: 503 });
  }
}
