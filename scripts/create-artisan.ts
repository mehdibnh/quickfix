import { StringDecoder } from "node:string_decoder";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import mongoose from "mongoose";
import { hashPassword } from "../src/lib/password";
import { ArtisanProfile } from "../src/models/artisan-profile";
import { User } from "../src/models/user";
import { connectToDatabase } from "../src/lib/mongodb";

const prompt = createInterface({ input: stdin, output: stdout });

function requiredAnswer(label: string): Promise<string> {
  return prompt.question(label).then((answer) => {
    const value = answer.trim();
    if (!value) throw new Error(`${label.trim()} est obligatoire.`);
    return value;
  });
}

function hiddenAnswer(label: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode) {
    throw new Error("Cette commande doit être lancée dans un terminal interactif pour saisir le mot de passe.");
  }

  prompt.pause();
  stdout.write(label);
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    const decoder = new StringDecoder("utf8");

    function finish(error?: Error) {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      prompt.resume();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }

    function onData(chunk: Buffer) {
      for (const character of decoder.write(chunk)) {
        if (character === "\u0003") {
          finish(new Error("Saisie annulée."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          const characters = Array.from(value);
          if (characters.length) {
            characters.pop();
            value = characters.join("");
            stdout.write("\b \b");
          }
          continue;
        }
        if (character >= " ") {
          value += character;
          stdout.write("*");
        }
      }
    }

    stdin.on("data", onData);
  });
}

async function createArtisan(index: number) {
  console.log(`\n--- Artisan ${index} ---`);
  const name = await requiredAnswer("Nom complet : ");
  const email = (await requiredAnswer("Adresse e-mail : ")).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("L'adresse e-mail n'est pas valide.");
  }
  const phone = await requiredAnswer("Téléphone : ");
  const category = await requiredAnswer("Métier / filière (ex. Plomberie, Électricité, Climatisation, Peinture, Ménage, Serrurerie) : ");
  const city = await requiredAnswer("Ville : ");
  const bio = await requiredAnswer("Courte présentation : ");
  const password = await hiddenAnswer("Mot de passe (12 caractères minimum, masqué) : ");
  if (password.length < 12) {
    throw new Error("Le mot de passe doit contenir au moins 12 caractères.");
  }
  const confirmation = await hiddenAnswer("Confirmer le mot de passe : ");
  if (password !== confirmation) {
    throw new Error("Les mots de passe ne correspondent pas.");
  }

  await connectToDatabase();
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const [user] = await User.create(
        [{ name, email, phone, passwordHash: await hashPassword(password), role: "ARTISAN" }],
        { session },
      );
      await ArtisanProfile.create([{ userId: user._id, category, city, bio }], { session });
    });
  } finally {
    await session.endSession();
  }

  console.log(`Compte créé pour ${email}. Son profil est en attente de vérification.`);
}

async function main() {
  console.log("Création de comptes artisans MongoDB. Saisis uniquement les informations de personnes qui ont donné leur accord.");
  console.log("Les informations restent dans ce terminal et chaque nouveau profil devra être vérifié avant publication.");

  let count = 0;
  do {
    await createArtisan(count + 1);
    count += 1;
  } while ((await prompt.question("\nCréer un autre artisan ? (o/N) : ")).trim().toLowerCase() === "o");

  console.log(`\nTerminé : ${count} compte(s) artisan créé(s).`);
}

main()
  .catch((error: unknown) => {
    console.error("Création impossible :", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    prompt.close();
    await mongoose.disconnect();
  });
