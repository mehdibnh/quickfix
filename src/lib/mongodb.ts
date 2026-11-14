
import dns from "node:dns/promises";
import type mongoose from "mongoose";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI n'est pas configurée. Copiez .env.example vers .env.local et ajoutez votre URI MongoDB.");
  }
  return uri;
}

type MongooseCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cache = globalForMongoose.mongooseCache ?? { connection: null, promise: null };
globalForMongoose.mongooseCache = cache;

export async function connectToDatabase() {
  if (cache.connection) return cache.connection;

  if (!cache.promise) {
    console.log("DNS utilisés:", dns.getServers());

    const mongoose = (await import("mongoose")).default;

    cache.promise = mongoose.connect(getMongoUri()).catch((error: unknown) => {
      cache.promise = null;
      throw new Error("Connexion à MongoDB impossible. Vérifiez MONGODB_URI et la disponibilité de votre serveur.", { cause: error });
    });
  }

  cache.connection = await cache.promise;
  return cache.connection;
}
