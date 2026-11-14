import { connectToDatabase } from "@/lib/mongodb";

export async function GET() {
  if (!process.env.MONGODB_URI) {
    return Response.json(
      { status: "not_configured", message: "La variable MONGODB_URI n'est pas définie." },
      { status: 503 },
    );
  }

  try {
    const connection = await connectToDatabase();
    return Response.json({ status: "connected", database: connection.connection.name });
  } catch (error) {
    console.error("MongoDB ERROR:", error);

    return Response.json(
      { status: "disconnected", message: "Connexion MongoDB impossible. Vérifiez la configuration et l'accès réseau." },
      { status: 503 },
    );
  }
}