import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PhotoViewer from '@/components/PhotoViewer';
import '@testing-library/jest-dom';

// Mock fetch
global.fetch = jest.fn();

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ priority, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />;
  },
}));

// Mock child components
jest.mock('@/components/Controls', () => ({
  __esModule: true,
  default: ({ onNext, onLike }: any) => (
    <div data-testid="controls">
      <button onClick={onLike}>Like</button>
      <button onClick={onNext}>Next</button>
    </div>
  ),
}));

jest.mock('@/components/MetadataEditor', () => ({
  __esModule: true,
  default: () => <div data-testid="metadata-editor">Editor</div>
}));

describe('PhotoViewer Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => { })); // Never resolves
    render(<PhotoViewer />);
    expect(screen.getByText('Loading photos...')).toBeInTheDocument();
  });

  it('renders photos when fetched successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        photos: [
          { _id: '1', url: '/test1.jpg', metadata: { prompt: 'Test Photo 1' } },
        ],
      }),
    });

    render(<PhotoViewer />);

    await waitFor(() => {
      expect(screen.getByAltText('Test Photo 1')).toBeInTheDocument();
    });

    expect(screen.getByAltText('Test Photo 1')).toHaveAttribute('src', '/test1.jpg');
  });

  it('handles interactions correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        photos: [
          { _id: '1', url: '/test1.jpg' },
        ],
      }),
    });

    render(<PhotoViewer />);

    await waitFor(() => {
      expect(screen.getByTestId('controls')).toBeInTheDocument();
    });

    // Mock interaction API call
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

    fireEvent.click(screen.getByText('Like'));

    await waitFor(() => {
      // First call was fetching photos, second should be interaction
      expect(global.fetch).toHaveBeenCalledTimes(3);
      // 1. Initial fetch
      // 2. VIEW interaction (useEffect)
      // 3. LIKE interaction
    });

    const calls = (global.fetch as jest.Mock).mock.calls;
    const interactionCalls = calls.filter(call => call[0] === '/api/photos/interaction');

    const likeCall = interactionCalls.find(call => JSON.parse(call[1].body).type === 'LIKE');

    expect(likeCall).toBeDefined();
    expect(JSON.parse(likeCall[1].body)).toMatchObject({
      photoId: '1',
      type: 'LIKE',
    });
  });

  it('displays empty state with seed button when no photos', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ photos: [] }),
    });

    render(<PhotoViewer />);

    await waitFor(() => {
      expect(screen.getByText('No photos found.')).toBeInTheDocument();
      expect(screen.getByText('Seed Database with Sample Photos')).toBeInTheDocument();
    });
  });
});
