export interface Photo {
  _id: string;
  source: 'GOOGLE' | 'ICLOUD' | 'LOCAL';
  externalId: string;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
  isLiked?: boolean;
  isFavorited?: boolean;
  lastDisplayedAt?: string; // Serialized date
  displayCount: number;
}

export interface Interaction {
  _id: string;
  userId: string;
  photoId: string;
  type: 'VIEW' | 'LIKE' | 'DISLIKE' | 'SKIP' | 'FAVORITE';
  metadata?: Record<string, any>;
  createdAt: string;
}
