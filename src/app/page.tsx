
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { PenTool, BarChart3, LayoutGrid } from 'lucide-react';

export default function HomePage() {
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
          <Link href="/" className="flex items-center gap-3">
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
        <main className="flex-1 flex flex-col items-center">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 items-center">
              <div className="lg:col-span-3 flex flex-col gap-8">
                <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-c-green">Intelligent Land Analysis at Scale.</h1>
                <p className="text-lg md:text-xl text-c-charcoal max-w-lg">Visualize terrain, analyze slopes, and unlock property potential with AI-powered insights.</p>
                <Button asChild className="min-w-[84px] max-w-fit cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-c-orange text-white text-lg font-bold shadow-md hover:shadow-lg transition-shadow">
                  <Link href="/vision">
                    <span className="truncate">Launch Application</span>
                  </Link>
                </Button>
              </div>
              <div className="lg:col-span-2 relative">
                <div 
                  className="w-full aspect-[4/3] bg-cover bg-center rounded-2xl shadow-2xl" 
                  style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCaX4OmYpjLHgXLI5EyuAeqAkxVcGjI0OCBAtXBeooWkjG0FUP05xRXfi17eVfk7yJzPlfZxm-HaKIoGrJSW2AoF5Dh6Gq40yuAgEPQJQoqc2p2CLfHmSjztb8hpzGNfLmWP-lguoLHNPBJIz9jHWMwvfY7KuZYIGcmhPahYCpY6TjE4Gx_zv7_zL05sB7xhL4eDaE7aWQRB5DeExuLv6TDiOX32JO6wWAqL6q-R4Yeqis5h14u9032h1cwhPqktXP_IoUFuqzlWLIi")'}}
                  data-ai-hint="topographical map abstract"
                ></div>
                <div className="absolute -bottom-8 -left-8 bg-white/70 backdrop-blur-md p-4 rounded-lg shadow-lg">
                  <p className="text-sm font-semibold text-c-charcoal">Total Area</p>
                  <p className="text-2xl font-bold text-c-green">15.7 Acres</p>
                </div>
                <div className="absolute -top-8 -right-8 bg-white/70 backdrop-blur-md p-4 rounded-lg shadow-lg">
                  <p className="text-sm font-semibold text-c-charcoal">Max Slope</p>
                  <p className="text-2xl font-bold text-c-green">28.5%</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="w-full bg-white py-24">
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
              <div className="mt-20 text-center">
                 <Button asChild className="min-w-[84px] max-w-fit cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-c-green text-white text-lg font-bold shadow-md hover:shadow-lg transition-shadow">
                  <Link href="/signup">
                    <span className="truncate">Get Started for Free</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
