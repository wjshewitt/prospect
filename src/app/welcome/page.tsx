
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, Layers, Bot, BarChart3, LayoutGrid, PenTool } from 'lucide-react';

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-c-orange text-white mb-4">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-c-green mb-2">{title}</h3>
    <p className="text-c-charcoal/80">{description}</p>
  </div>
);


export default function WelcomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/');
  };

  return (
    <div className="relative flex size-full min-h-screen flex-col bg-c-off-white text-c-charcoal font-sans">
       <div className="layout-container flex h-full grow flex-col">
        <header className="flex items-center justify-between whitespace-nowrap px-10 py-5">
          <Link href="/welcome" className="flex items-center gap-3">
            <svg className="h-8 w-8 text-c-green" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path clipRule="evenodd" d="M12.0799 24L4 19.2479L9.95537 8.75216L18.04 13.4961L18.0446 4H29.9554L29.96 13.4961L38.0446 8.75216L44 19.2479L35.92 24L44 28.7521L38.0446 39.2479L29.96 34.5039L29.9554 44H18.0446L18.04 34.5039L9.95537 39.2479L4 28.7521L12.0799 24Z" fill="currentColor" fillRule="evenodd"></path>
            </svg>
            <h2 className="text-2xl font-bold tracking-tight">LandVision</h2>
          </Link>
          <nav className="flex items-center gap-4">
            {loading ? null : user ? (
              <>
                <Button variant="outline" asChild>
                  <Link href="/vision">Go to App</Link>
                </Button>
                <Button onClick={handleSignOut}>Sign Out</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">Log In</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </nav>
        </header>

        <main className="flex-1 flex flex-col">
          {/* Hero Section */}
          <section className="text-center py-20 px-4 bg-white">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-c-green">
              Welcome{user ? `, ${user.email?.split('@')[0]}` : ''}!
            </h1>
            <p className="text-lg md:text-xl text-c-charcoal max-w-2xl mx-auto mt-4">
              You're all set to start analyzing properties. Dive into the app or explore the features below.
            </p>
            <Button asChild className="mt-8 min-w-[84px] max-w-fit cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-c-orange text-white text-lg font-bold shadow-md hover:shadow-lg transition-shadow">
              <Link href="/vision">
                <span className="truncate">Launch LandVision App</span>
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </section>

          {/* Features Section */}
          <section className="py-24 px-4">
            <div className="mx-auto max-w-7xl">
              <div className="text-center mb-16">
                  <h2 className="text-4xl font-extrabold tracking-tight text-c-green">App Features</h2>
                  <p className="mt-4 text-lg text-c-charcoal max-w-2xl mx-auto">Discover the powerful tools at your disposal.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <FeatureCard 
                  icon={<Eye className="h-6 w-6" />}
                  title="3D Site Visualization"
                  description="Transform 2D satellite maps into interactive 3D models to get a true sense of the terrain and elevation."
                />
                <FeatureCard 
                  icon={<Layers className="h-6 w-6" />}
                  title="Topographic Analysis"
                  description="Instantly calculate slope, aspect, and elevation data across your entire site to identify buildable areas."
                />
                <FeatureCard 
                  icon={<Bot className="h-6 w-6" />}
                  title="AI-Powered Insights"
                  description="Leverage AI to generate site summaries, suggest optimal building placements, and create procedural layouts."
                />
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="w-full bg-white py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-extrabold tracking-tight text-c-green">How It Works</h2>
                <p className="mt-4 text-lg text-c-charcoal max-w-2xl mx-auto">From raw land to a development plan in three simple steps.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-c-orange text-white mb-6">
                    <PenTool className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-c-green mb-2">1. Draw Your Site</h3>
                  <p className="text-c-charcoal">Use our simple drawing tools to outline any property boundary directly on the satellite map.</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-c-orange text-white mb-6">
                    <BarChart3 className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-c-green mb-2">2. Analyze & Visualize</h3>
                  <p className="text-c-charcoal">Instantly generate a 3D model and get a detailed topographic analysis, including slope and elevation data.</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-c-orange text-white mb-6">
                    <LayoutGrid className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-c-green mb-2">3. Generate & Plan</h3>
                  <p className="text-c-charcoal">Use AI to generate potential building layouts and zoning plans to rapidly prototype your development ideas.</p>
                </div>
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
