import { connectToDatabase } from "@/lib/mongodb";
import { ArtisanProfile } from "@/models/artisan-profile";
import { Review } from "@/models/review";
import { User } from "@/models/user";

type ArtisanListItem = {
  id: string;
  name: string;
  category: string;
  city: string;
  bio: string;
  isAvailable: boolean;
  indicativePriceMin: number | null;
  rating: number | null;
  reviews: number;
};

export async function GET() {
  if (!process.env.MONGODB_URI) {
    return Response.json({ error: "Le service est momentanément indisponible." }, { status: 503 });
  }

  try {
    await connectToDatabase();
    const artisans = await ArtisanProfile.aggregate<ArtisanListItem>([
      { $match: { verificationStatus: "VERIFIED" } },
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
                    { $eq: ["$isSuspended", false] },
                  ],
                },
              },
            },
            { $project: { name: 1 } },
          ],
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: Review.collection.name,
          let: { artisanId: "$user._id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$artisanId", "$$artisanId"] },
                    { $eq: ["$isHidden", false] },
                  ],
                },
              },
            },
            { $group: { _id: null, rating: { $avg: "$rating" }, count: { $sum: 1 } } },
          ],
          as: "reviewStats",
        },
      },
      {
        $project: {
          _id: 0,
          id: { $toString: "$user._id" },
          name: "$user.name",
          category: 1,
          city: 1,
          bio: 1,
          isAvailable: 1,
          indicativePriceMin: { $ifNull: ["$indicativePriceMin", null] },
          rating: { $ifNull: [{ $arrayElemAt: ["$reviewStats.rating", 0] }, null] },
          reviews: { $ifNull: [{ $arrayElemAt: ["$reviewStats.count", 0] }, 0] },
        },
      },
    ]);

    return Response.json({ artisans });
  } catch (error) {
    console.error("Chargement des artisans impossible :", error);
    return Response.json({ error: "Impossible de charger les artisans pour le moment." }, { status: 503 });
  }
}
