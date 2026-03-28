import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type ArticleStatus = "draft" | "approved" | "rejected" | "published";

export interface IArticle extends Document {
  title: string;
  slug: string;
  content: string;
  category: "tech" | "history";
  keywords: string[];
  metaTitle: string;
  metaDescription: string;
  clusterId: Types.ObjectId;
  status: ArticleStatus;
  readingTimeMinutes: number;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ArticleSchema = new Schema<IArticle>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    content: { type: String, required: true },
    category: {
      type: String,
      enum: ["tech", "history"],
      required: true,
      default: "tech",
    },
    keywords: { type: [String], default: [] },
    metaTitle: { type: String, required: true },
    metaDescription: { type: String, required: true },
    clusterId: {
      type: Schema.Types.ObjectId,
      ref: "TopicCluster",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "approved", "rejected", "published"],
      default: "draft",
      index: true,
    },
    readingTimeMinutes: { type: Number, default: 1 },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

export const Article: Model<IArticle> =
  mongoose.models.Article || mongoose.model<IArticle>("Article", ArticleSchema);
