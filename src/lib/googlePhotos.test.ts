import { listPickedMediaItems } from './googlePhotos';
import { downloadImage } from '@/lib/storage';
import Photo from '@/models/Photo';
import Account from '@/models/Account';

// Mock dependencies
jest.mock('@/lib/storage');
// Mock dependencies
jest.mock('@/lib/storage');
jest.mock('@/models/Photo', () => ({
  __esModule: true,
  default: {
    bulkWrite: jest.fn(),
    find: jest.fn(),
    deleteMany: jest.fn(),
  },
}));
jest.mock('@/models/Account', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));
jest.mock('@/lib/db', () => jest.fn()); // Mock connectToDatabase

// Mock global fetch
global.fetch = jest.fn();

describe('Google Photos Import Logic', () => {
  const mockUserId = 'user123';
  const mockSessionId = 'session_abc';
  const mockAccessToken = 'fake_access_token';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Account.findOne to return a valid token
    (Account.findOne as jest.Mock).mockResolvedValue({
      access_token: mockAccessToken,
      refresh_token: 'fake_refresh_token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
      save: jest.fn(),
    });
  });

  it('should successfully import photos and download them', async () => {
    // Mock fetch to handle multiple calls
    (global.fetch as jest.Mock)
        // 1. First call might be token refresh if access_token invalid? 
        // Actually, our mock Account says token is valid (expires_at future).
        // But getGoogleAccessToken calls fetch if it needs to refresh.
        // Let's verify what's happening. 
        // Ah, listPickedMediaItems calls getGoogleAccessToken.
        // If we want to skip refresh, we ensure expires_at is far future.
        // In beforeEach, we set it to +3600.
        // So it should NOT call refresh.
        // The first fetch should be listMediaItems.
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                mediaItems: [
                {
                    id: 'photo1',
                    mediaFile: {
                        baseUrl: 'https://lh3.googleusercontent.com/photo1',
                        mediaWidth: '4000',
                        mediaHeight: '3000',
                        mimeType: 'image/jpeg',
                        filename: 'photo1.jpg',
                    },
                },
                ],
                nextPageToken: null
            }),
        });

    // Mock downloadImage
    (downloadImage as jest.Mock).mockResolvedValue('/uploads/photo1.jpg');

    // Mock Photo.bulkWrite
    (Photo.bulkWrite as jest.Mock).mockResolvedValue({ insertedCount: 1 });

    const result = await listPickedMediaItems(mockUserId, mockSessionId);

    expect(result.count).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify dependencies were called correctly
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://photospicker.googleapis.com/v1/mediaItems'),
      expect.objectContaining({
        headers: { Authorization: `Bearer ${mockAccessToken}` },
      })
    );

    expect(downloadImage).toHaveBeenCalledWith(
      expect.stringContaining('https://lh3.googleusercontent.com/photo1=w2048-h1536'), // Resized URL
      'photo1.jpg',
      mockAccessToken
    );
  });

  it('should handle API errors gracefully', async () => {
    // Mock Picker API error
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
      json: async () => ({ error: 'Forbidden' }), // Add json for completeness
    });

    await expect(listPickedMediaItems(mockUserId, mockSessionId)).rejects.toThrow('Failed to list picked media items: 403 Forbidden');
  });

  it('should capture download errors but continue importing', async () => {
    // Mock Picker API response with 2 items
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mediaItems: [
          { id: 'good_photo', mediaFile: { baseUrl: 'url1', mediaWidth: '100', mediaHeight: '100' } },
          { id: 'bad_photo', mediaFile: { baseUrl: 'url2', mediaWidth: '100', mediaHeight: '100' } },
        ],
      }),
    });

    // Mock downloadImage: first success, second fails
    (downloadImage as jest.Mock)
      .mockResolvedValueOnce('/uploads/good.jpg')
      .mockRejectedValueOnce(new Error('Network error'));

    const result = await listPickedMediaItems(mockUserId, mockSessionId);

    expect(result.count).toBe(1); // Only 1 succeeded
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Failed to download bad_photo');
  });

  it('should handle missing dimensions by using default resize', async () => {
    // Mock Picker API response with missing dimensions
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mediaItems: [
          {
            id: 'photo_no_dims',
            mediaFile: {
              baseUrl: 'https://lh3.googleusercontent.com/photo_no_dims',
              // mediaWidth missing
              // mediaHeight missing
              mimeType: 'image/jpeg',
              filename: 'photo_no_dims.jpg',
            },
          },
        ],
      }),
    });

    // Mock downloadImage
    (downloadImage as jest.Mock).mockResolvedValue('/uploads/photo_no_dims.jpg');

    const result = await listPickedMediaItems(mockUserId, mockSessionId);

    expect(result.count).toBe(1);
    expect(result.errors).toHaveLength(0);

    expect(downloadImage).toHaveBeenCalledWith(
      expect.stringContaining('https://lh3.googleusercontent.com/photo_no_dims=d'),
      'photo_no_dims.jpg',
      mockAccessToken
    );
  });
});
