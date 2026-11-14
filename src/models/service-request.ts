import { model, models, Schema, type InferSchemaType } from "mongoose";

const statusHistorySchema = new Schema(
  {
    status: { type: String, enum: ["EN_ATTENTE", "ACCEPTEE", "EN_COURS", "TERMINEE", "REFUSEE", "ANNULEE"], required: true },
    changedAt: { type: Date, required: true, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const serviceRequestSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    artisanId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["EN_ATTENTE", "ACCEPTEE", "EN_COURS", "TERMINEE", "REFUSEE", "ANNULEE"],
      default: "EN_ATTENTE",
      index: true,
    },
    announcedPrice: { type: Number, min: 0 },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true },
);

serviceRequestSchema.index({ clientId: 1, createdAt: -1 });
serviceRequestSchema.index({ artisanId: 1, status: 1 });

export type ServiceRequestDocument = InferSchemaType<typeof serviceRequestSchema>;
export const ServiceRequest = models.ServiceRequest ?? model("ServiceRequest", serviceRequestSchema);
