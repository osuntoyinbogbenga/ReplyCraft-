import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
          ReplyCraft
        </h1>
        <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 mb-8">
          Generate natural, human-like replies with AI
        </p>
        <p className="text-gray-600 dark:text-gray-400 mb-12 text-lg">
          Never struggle with message replies again. ReplyCraft helps you craft perfect responses
          for any situation.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="px-8 py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-lg font-semibold"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 rounded-lg border-2 border-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors text-lg font-semibold"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}