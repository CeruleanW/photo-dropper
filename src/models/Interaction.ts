import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInteraction extends Document {
  userId: mongoose.Types.ObjectId;
  photoId: mongoose.Types.ObjectId;
  type: 'VIEW' | 'LIKE' | 'DISLIKE' | 'SKIP' | 'FAVORITE';
  metadata?: Record<string, any>;
  createdAt: Date;
}

const InteractionSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    photoId: { type: Schema.Types.ObjectId, ref: 'Photo', required: true },
    type: {
      type: String,
      enum: ['VIEW', 'LIKE', 'DISLIKE', 'SKIP', 'FAVORITE'],
      required: true,
    },
    metadata: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

InteractionSchema.index({ userId: 1, photoId: 1 });
InteractionSchema.index({ createdAt: -1 });

const Interaction: Model<IInteraction> =
  mongoose.models.Interaction ||
  mongoose.model<IInteraction>('Interaction', InteractionSchema);

export default Interaction;
