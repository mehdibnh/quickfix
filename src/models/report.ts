import { model, models, Schema, type InferSchemaType } from "mongoose";

const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetType: { type: String, enum: ["USER", "REVIEW", "REQUEST"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 1200 },
    status: { type: String, enum: ["OUVERT", "EN_COURS", "RESOLU"], default: "OUVERT", index: true },
    resolutionNote: { type: String, trim: true, maxlength: 1000 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

export type ReportDocument = InferSchemaType<typeof reportSchema>;
export const Report = models.Report ?? model("Report", reportSchema);
