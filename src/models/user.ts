import { model, models, Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true, maxlength: 30 },
    role: { type: String, enum: ["CLIENT", "ARTISAN", "ADMIN"], required: true, default: "CLIENT" },
    isSuspended: { type: Boolean, default: false },
    suspensionReason: { type: String, trim: true, maxlength: 500 },
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = models.User ?? model("User", userSchema);
