
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, ArrowRight, Eye, Layers, DraftingCompass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showApp, setShowApp] = useState(false);
  
  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/welcome');
      } else {
        setShowApp(true);
      }
    }
  }, [user, loading, router]);
  
  if (!showApp) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-c-off-white text-c-charcoal font-body">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-c-off-white/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
             <svg className="h-8 w-8 text-c-green" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path clipRule="evenodd" d="M12.0799 24L4 19.2479L9.95537 8.75216L18.04 13.4961L18.0446 4H29.9554L29.96 13.4961L38.0446 8.75216L44 19.2479L35.92 24L44 28.7521L38.0446 39.2479L29.96 34.5039L29.9554 44H18.0446L18.04 34.5039L9.95537 39.2479L4 28.7521L12.0799 24Z" fill="currentColor" fillRule="evenodd"></path>
              </svg>
            <span className="text-2xl font-bold tracking-tight text-c-charcoal">
              LandVision
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link
              href="#features"
              className="text-base font-medium text-c-charcoal/80 transition-colors hover:text-c-charcoal"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-base font-medium text-c-charcoal/80 transition-colors hover:text-c-charcoal"
            >
              How It Works
            </Link>
          </nav>
          <div className="flex items-center gap-2">
             <Button asChild variant="ghost">
              <Link href="/login">
                Sign In
              </Link>
            </Button>
            <Button asChild>
              <Link href="/signup">
                Sign Up Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 py-20 md:grid-cols-2 md:px-6 lg:py-28">
          <div className="space-y-6">
            <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-c-charcoal md:text-5xl lg:text-6xl">
              Visualize Land Development in Minutes, Not Months.
            </h1>
            <p className="max-w-[600px] text-lg text-c-charcoal/80 md:text-xl">
              LandVision uses AI to help developers, planners, and architects analyze properties, generate site layouts, and visualize potential like never before.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
               <Button asChild size="lg">
                 <Link href="/signup">
                    Get Started for Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                 </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                 <Link href="#how-it-works">
                    Learn How It Works
                 </Link>
              </Button>
            </div>
          </div>
          <div className="relative h-[400px] w-full overflow-hidden rounded-2xl shadow-2xl">
            <Image
                src="https://picsum.photos/1200/800"
                alt="AI-generated site plan"
                fill
                className="object-cover"
                data-ai-hint="site plan aerial"
                priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="bg-white py-20 lg:py-28">
            <div className="container mx-auto px-4 md:px-6">
                <div className="mx-auto max-w-3xl text-center">
                     <h2 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
                        Powerful Tools for Smarter Land Development
                    </h2>
                    <p className="mt-4 text-lg text-c-charcoal/70">
                        From initial assessment to detailed planning, LandVision provides the insights you need.
                    </p>
                </div>
                 <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-3">
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-c-orange/20 text-c-orange">
                            <Eye className="h-7 w-7" />
                        </div>
                        <h3 className="mb-2 text-xl font-bold">3D Site Visualization</h3>
                        <p className="text-c-charcoal/70">Instantly generate and explore a high-fidelity 3D model of your site's topography and proposed buildings.</p>
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-c-green/20 text-c-green">
                            <Layers className="h-7 w-7" />
                        </div>
                        <h3 className="mb-2 text-xl font-bold">Topography & Slope Analysis</h3>
                        <p className="text-c-charcoal/70">Automatically analyze elevation data to identify buildable areas, steep slopes, and potential site constraints.</p>
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-c-charcoal/20 text-c-charcoal">
                            <DraftingCompass className="h-7 w-7" />
                        </div>
                        <h3 className="mb-2 text-xl font-bold">AI-Powered Layouts</h3>
                        <p className="text-c-charcoal/70">Generate procedural building and solar panel layouts based on your defined zones and density requirements.</p>
                    </div>
                </div>
            </div>
        </section>

        {/* How it Works Section */}
        <section id="how-it-works" className="py-20 lg:py-28">
            <div className="container mx-auto px-4 md:px-6">
                <div className="mx-auto max-w-3xl text-center">
                    <h2 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
                        Get Started in Three Simple Steps
                    </h2>
                    <p className="mt-4 text-lg text-c-charcoal/70">
                        Go from a blank canvas to a detailed site plan in minutes.
                    </p>
                </div>

                 <div className="mt-16 grid grid-cols-1 items-start gap-12 md:grid-cols-3">
                    {/* Step 1 */}
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-6 h-48 w-full overflow-hidden rounded-lg shadow-md">
                            <Image src="https://picsum.photos/400/300?random=1" alt="Drawing a boundary on a map" width={400} height={300} className="h-full w-full object-cover" data-ai-hint="map outline" />
                        </div>
                        <h3 className="mb-2 text-xl font-bold">1. Define Your Site</h3>
                        <p className="text-c-charcoal/70">Use our intuitive drawing tools to outline the boundary of your project area on the map.</p>
                    </div>

                    {/* Step 2 */}
                    <div className="flex flex-col items-center text-center">
                       <div className="mb-6 h-48 w-full overflow-hidden rounded-lg shadow-md">
                            <Image src="https://picsum.photos/400/300?random=2" alt="A grid showing slope analysis on a map" width={400} height={300} className="h-full w-full object-cover" data-ai-hint="map analysis" />
                        </div>
                        <h3 className="mb-2 text-xl font-bold">2. Analyze the Terrain</h3>
                        <p className="text-c-charcoal/70">With one click, analyze the site's topography to understand slopes, elevations, and buildable areas.</p>
                    </div>

                    {/* Step 3 */}
                    <div className="flex flex-col items-center text-center">
                         <div className="mb-6 h-48 w-full overflow-hidden rounded-lg shadow-md">
                            <Image src="https://picsum.photos/400/300?random=3" alt="3D rendering of buildings on a landscape" width={400} height={300} className="h-full w-full object-cover" data-ai-hint="3d model" />
                        </div>
                        <h3 className="mb-2 text-xl font-bold">3. Generate & Visualize</h3>
                        <p className="text-c-charcoal/70">Define development zones and let the AI generate building layouts, then explore your project in a stunning 3D view.</p>
                    </div>
                </div>

                <div className="mt-20 text-center">
                     <Button asChild size="lg">
                        <Link href="/signup">
                            Start Your Free Analysis
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                    </Button>
                </div>
            </div>
        </section>

      </main>

       {/* Footer */}
      <footer className="bg-white">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row md:px-6">
            <p className="text-sm text-c-charcoal/60">© {new Date().getFullYear()} LandVision. All rights reserved.</p>
             <div className="flex items-center gap-2">
                <svg className="h-6 w-6 text-c-green" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path clipRule="evenodd" d="M12.0799 24L4 19.2479L9.95537 8.75216L18.04 13.4961L18.0446 4H29.9554L29.96 13.4961L38.0446 8.75216L44 19.2479L35.92 24L44 28.7521L38.0446 39.2479L29.96 34.5039L29.9554 44H18.0446L18.04 34.5039L9.95537 39.2479L4 28.7521L12.0799 24Z" fill="currentColor" fillRule="evenodd"></path>
                </svg>
                <span className="text-lg font-semibold text-c-charcoal">LandVision</span>
            </div>
        </div>
      </footer>
    </div>
  );
}
