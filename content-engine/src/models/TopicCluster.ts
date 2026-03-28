import mongoose, { Document, Model, Schema } from "mongoose";

export type TopicCategory = "tech" | "history";

export interface ITopicCluster extends Document {
  baseTopic: string;
  keywords: string[];
  questions: string[];
  relatedSearches: string[];
  generatedTitles: string[];
  category: TopicCategory;
  createdAt: Date;
}

const TopicClusterSchema = new Schema<ITopicCluster>(
  {
    baseTopic: { type: String, required: true, trim: true },
    keywords: { type: [String], default: [] },
    questions: { type: [String], default: [] },
    relatedSearches: { type: [String], default: [] },
    generatedTitles: { type: [String], default: [] },
    category: {
      type: String,
      enum: ["tech", "history"],
      required: true,
      default: "tech",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const TopicCluster: Model<ITopicCluster> =
  mongoose.models.TopicCluster ||
  mongoose.model<ITopicCluster>("TopicCluster", TopicClusterSchema);
