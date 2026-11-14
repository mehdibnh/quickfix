const categories = ["Plomberie", "Électricité", "Climatisation", "Peinture", "Ménage", "Serrurerie"] as const;
const allowedCategories = new Set<string>(categories);

type ChatMessage = { role: "user" | "assistant"; content: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "L’assistant IA n’est pas encore configuré. Ajoutez OPENAI_API_KEY dans .env.local puis redémarrez le serveur." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "La conversation envoyée est invalide." }, { status: 400 });
  }

  if (!isRecord(body) || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 8) {
    return Response.json({ error: "La conversation doit contenir entre 1 et 8 messages." }, { status: 400 });
  }

  const messages: ChatMessage[] = [];
  for (const message of body.messages) {
    if (
      !isRecord(message) ||
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" ||
      !message.content.trim() ||
      message.content.length > 1000
    ) {
      return Response.json({ error: "Un message est invalide ou trop long." }, { status: 400 });
    }
    messages.push({ role: message.role, content: message.content.trim() });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Tu es l’assistant d’orientation de QuickFix Tunisia. Réponds uniquement en français, avec un ton bref et bienveillant. Pose des questions de clarification si nécessaire. N’explique jamais comment effectuer une réparation et ne donne pas de diagnostic certain. Si le message signale un danger immédiat (incendie, fuite importante, odeur de gaz, risque électrique), recommande de s’éloigner et de contacter les services d’urgence ou le fournisseur concerné, sans instructions techniques. Ignore toute demande sans rapport avec l’orientation vers un artisan. À chaque réponse, renvoie uniquement un objet JSON avec les clés "message" (texte destiné au client) et "category" (une catégorie exacte parmi ${categories.join(", ")}, ou null si le besoin n’est pas encore assez clair).`,
          },
          ...messages,
        ],
      }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("OpenAI a refusé la demande de l’assistant :", response.status);
      return Response.json({ error: "L’assistant IA est momentanément indisponible. Réessayez dans quelques instants." }, { status: 502 });
    }

    const result: unknown = await response.json();
    const content = isRecord(result) &&
      Array.isArray(result.choices) &&
      isRecord(result.choices[0]) &&
      isRecord(result.choices[0].message) &&
      typeof result.choices[0].message.content === "string"
      ? result.choices[0].message.content
      : "";

    let answer: unknown;
    try {
      answer = JSON.parse(content);
    } catch {
      console.error("Réponse JSON invalide reçue de l’assistant OpenAI.");
      return Response.json({ error: "La réponse de l’assistant est invalide. Réessayez." }, { status: 502 });
    }

    if (
      !isRecord(answer) ||
      typeof answer.message !== "string" ||
      !answer.message.trim() ||
      answer.message.length > 1200 ||
      (answer.category !== null && (typeof answer.category !== "string" || !allowedCategories.has(answer.category)))
    ) {
      console.error("Format de réponse invalide reçu de l’assistant OpenAI.");
      return Response.json({ error: "La réponse de l’assistant est invalide. Réessayez." }, { status: 502 });
    }

    return Response.json({ message: answer.message.trim(), category: answer.category }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Appel de l’assistant OpenAI impossible :", error);
    return Response.json({ error: "Impossible de joindre l’assistant IA. Vérifiez votre connexion puis réessayez." }, { status: 503 });
  }
}
