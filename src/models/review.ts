import { model, models, Schema, type InferSchemaType } from "mongoose";

const reviewSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: "ServiceRequest", required: true, unique: true },
    clientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    artisanId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1200, default: "" },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type ReviewDocument = InferSchemaType<typeof reviewSchema>;
export const Review = models.Review ?? model("Review", reviewSchema);
