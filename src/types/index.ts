export interface Photo {
  _id: string;
  source: 'GOOGLE' | 'ICLOUD' | 'LOCAL' | 'PIXIV';
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
  type: 'VIEW' | 'LIKE' | 'DISLIKE' | 'SKIP' | 'FAVORITE' | 'COMMENT';
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface PhotoComment {
  _id: string;
  userId: string;
  text: string;
  createdAt: string;
}
