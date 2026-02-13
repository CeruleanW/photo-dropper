import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAccount extends Document {
  provider: string;
  type: string;
  providerAccountId: string;
  access_token?: string;
  expires_at?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  userId: mongoose.Types.ObjectId;
}

const AccountSchema: Schema = new Schema(
  {
    provider: { type: String, required: true },
    type: { type: String, required: true },
    providerAccountId: { type: String, required: true },
    access_token: { type: String },
    expires_at: { type: Number },
    refresh_token: { type: String },
    scope: { type: String },
    token_type: { type: String },
    id_token: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

AccountSchema.index({ provider: 1, providerAccountId: 1 }, { unique: true });
AccountSchema.index({ userId: 1 });

const Account: Model<IAccount> =
  mongoose.models.Account || mongoose.model<IAccount>('Account', AccountSchema);

export default Account;
