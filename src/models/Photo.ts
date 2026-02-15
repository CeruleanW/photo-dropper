import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPhoto extends Document {
  userId: string;
  source: 'GOOGLE' | 'ICLOUD' | 'LOCAL' | 'PIXIV';
  externalId: string;
  url: string;
  thumbnailUrl?: string;
  metadata: Record<string, any>;
  isLiked: boolean;
  isFavorited: boolean;
  lastDisplayedAt?: Date;
  displayCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PhotoSchema: Schema = new Schema(
  {
    userId: { type: String, required: true },
    source: {
      type: String,
      enum: ['GOOGLE', 'ICLOUD', 'LOCAL', 'PIXIV'],
      required: true,
    },
    externalId: { type: String, required: true }, // unique per user ideally, but global unique compliant
    url: { type: String, required: true }, // Main URL or storage path
    thumbnailUrl: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
    isLiked: { type: Boolean, default: false },
    isFavorited: { type: Boolean, default: false },
    lastDisplayedAt: { type: Date },
    displayCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Index for efficient querying of next photo based on display history
PhotoSchema.index({ lastDisplayedAt: 1, displayCount: 1 });
// Compound index for deduplication lookups during import
PhotoSchema.index({ source: 1, externalId: 1, userId: 1 });
// Index for user-scoped queries (e.g. clearing photos by source)
PhotoSchema.index({ userId: 1, source: 1 });

const Photo: Model<IPhoto> =
  mongoose.models.Photo || mongoose.model<IPhoto>('Photo', PhotoSchema);

export default Photo;
