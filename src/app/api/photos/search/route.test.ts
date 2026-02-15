/**
 * @jest-environment node
 */
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';

import { GET } from './route';
import { NextRequest } from 'next/server';
import Photo from '@/models/Photo';
import connectToDatabase from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/db');
jest.mock('@/models/Photo', () => {
  return {
    __esModule: true,
    default: {
      find: jest.fn(),
    },
  };
});

describe('Search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty list if query is empty', async () => {
    const req = new NextRequest('http://localhost/api/photos/search?q=');
    const res = await GET(req);
    const data = await res.json();
    expect(data.photos).toEqual([]);
  });

  it('should search by description using regex', async () => {
    const req = new NextRequest('http://localhost/api/photos/search?q=test');
    
    // Mock database response
    const mockPhotos = [{ _id: '1', url: 'http://example.com/1.jpg', metadata: { description: 'This is a test photo' } }];
    const mockFind = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockPhotos),
    };
    (Photo.find as jest.Mock).mockReturnValue(mockFind);

    const res = await GET(req);
    const data = await res.json();

    expect(Photo.find).toHaveBeenCalledWith(expect.objectContaining({
      $or: expect.arrayContaining([
        { 'metadata.description': { $regex: /test/i } }
      ])
    }));
    expect(data.photos).toHaveLength(1);
    expect(data.photos[0].metadata.description).toContain('test');
  });

  it('should handle Chinese search queries', async () => {
    const query = '食物';
    const req = new NextRequest(`http://localhost/api/photos/search?q=${encodeURIComponent(query)}`);

    const mockPhotos = [{ _id: '2', url: 'http://example.com/2.jpg', metadata: { description: 'Delicious 食物 here' } }];
    const mockFind = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockPhotos),
    };
    (Photo.find as jest.Mock).mockReturnValue(mockFind);

    await GET(req);

    // Verify the regex construction for Chinese characters
    expect(Photo.find).toHaveBeenCalledWith(expect.objectContaining({
      $or: expect.arrayContaining([
        { 'metadata.description': { $regex: new RegExp(query, 'i') } }
      ])
    }));
  });
});
