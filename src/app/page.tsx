import PhotoViewer from '@/components/PhotoViewer';
import GooglePhotosIntegration from '@/components/GooglePhotosIntegration';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-8 md:p-24 bg-gray-50 dark:bg-zinc-950">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-xl w-full max-w-5xl">
        <div className="flex justify-between items-center mb-8 border-b pb-4 border-gray-100 dark:border-zinc-800">
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 mb-2">
              Photo Dropper AI
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Your personal intelligent photo curator.
            </p>
          </div>
          <GooglePhotosIntegration />
        </div>
        <PhotoViewer />
      </div>
    </main>
  );
}
