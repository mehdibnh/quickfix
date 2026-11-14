import { model, models, Schema, type InferSchemaType } from "mongoose";

const artisanProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    bio: { type: String, trim: true, maxlength: 1200, default: "" },
    indicativePriceMin: { type: Number, min: 0 },
    indicativePriceMax: { type: Number, min: 0 },
    isAvailable: { type: Boolean, default: true },
    verificationStatus: { type: String, enum: ["PENDING", "VERIFIED", "REJECTED"], default: "PENDING" },
    verificationReason: { type: String, trim: true, maxlength: 500 },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
  },
  { timestamps: true },
);

export type ArtisanProfileDocument = InferSchemaType<typeof artisanProfileSchema>;
export const ArtisanProfile = models.ArtisanProfile ?? model("ArtisanProfile", artisanProfileSchema);
