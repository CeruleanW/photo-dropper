import PhotoViewer from '@/components/PhotoViewer';
import GooglePhotosIntegration from '@/components/GooglePhotosIntegration';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 md:p-12 lg:p-24 bg-gray-50 dark:bg-zinc-950 relative overflow-hidden">
      {/* Background Mesh/Gradient */}
      <div className="absolute inset-0 z-0 opacity-40 dark:opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-400/30 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/30 blur-3xl" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-sky-300/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-6xl flex flex-col gap-6 md:gap-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-6 md:p-8 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-3xl border border-white/40 dark:border-zinc-800 shadow-xl">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 mb-2">
              Photo Dropper AI
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
              Your intelligent personal curator.
            </p>
          </div>
          <div className="w-full md:w-auto min-w-[300px]">
            <GooglePhotosIntegration />
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-lg rounded-3xl p-4 md:p-8 shadow-2xl border border-white/20 dark:border-zinc-800">
          <PhotoViewer />
        </div>
      </div>
    </main>
  );
}
