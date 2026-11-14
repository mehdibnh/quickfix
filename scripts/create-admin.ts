import { StringDecoder } from "node:string_decoder";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/mongodb";
import { hashPassword } from "../src/lib/password";
import { User } from "../src/models/user";

const prompt = createInterface({ input: stdin, output: stdout });

async function requiredAnswer(label: string): Promise<string> {
  const value = (await prompt.question(label)).trim();
  if (!value) throw new Error(`${label.trim()} est obligatoire.`);
  return value;
}

function hiddenAnswer(label: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode) {
    throw new Error("Lancez cette commande depuis un terminal interactif pour saisir le mot de passe.");
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

async function main() {
  console.log("Création d'un compte administrateur. Les informations restent dans ce terminal.");
  const name = await requiredAnswer("Nom complet : ");
  const email = (await requiredAnswer("Adresse e-mail : ")).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("L'adresse e-mail n'est pas valide.");
  }
  const password = await hiddenAnswer("Mot de passe (12 caractères minimum, masqué) : ");
  if (password.length < 12 || password.length > 128 || Buffer.byteLength(password, "utf8") > 256) {
    throw new Error("Le mot de passe doit contenir entre 12 et 128 caractères.");
  }
  const confirmation = await hiddenAnswer("Confirmer le mot de passe : ");
  if (password !== confirmation) throw new Error("Les mots de passe ne correspondent pas.");

  await connectToDatabase();
  await User.create({ name, email, passwordHash: await hashPassword(password), role: "ADMIN" });
  console.log(`Compte administrateur créé pour ${email}. Connectez-vous sur le site pour ouvrir le tableau de bord.`);
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
