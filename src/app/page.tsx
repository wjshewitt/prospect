
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="relative flex size-full min-h-screen flex-col bg-[var(--c-off-white)] text-[var(--c-charcoal)] font-sans">
      <div className="layout-container flex h-full grow flex-col">
        <header className="flex items-center justify-between whitespace-nowrap px-10 py-5">
          <Link href="/" className="flex items-center gap-3">
            <svg className="h-8 w-8 text-[var(--c-green)]" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path clipRule="evenodd" d="M12.0799 24L4 19.2479L9.95537 8.75216L18.04 13.4961L18.0446 4H29.9554L29.96 13.4961L38.0446 8.75216L44 19.2479L35.92 24L44 28.7521L38.0446 39.2479L29.96 34.5039L29.9554 44H18.0446L18.04 34.5039L9.95537 39.2479L4 28.7521L12.0799 24Z" fill="currentColor" fillRule="evenodd"></path>
            </svg>
            <h2 className="text-2xl font-bold tracking-tight">LandVision</h2>
          </Link>
          <nav className="flex items-center gap-8">
            <a className="text-base font-medium text-[var(--c-charcoal)] hover:text-[var(--c-green)] transition-colors" href="#">Features</a>
            <a className="text-base font-medium text-[var(--c-charcoal)] hover:text-[var(--c-green)] transition-colors" href="#">Resources</a>
          </nav>
        </header>
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="flex flex-col gap-8">
                <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-[var(--c-green)]">Intelligent Land Analysis at Scale.</h1>
                <p className="text-lg md:text-xl text-[var(--c-charcoal)]">Visualize terrain, analyze slopes, and unlock property potential with AI-powered insights.</p>
                <Button asChild className="min-w-[84px] max-w-fit cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-[var(--c-orange)] text-white text-lg font-bold shadow-md hover:shadow-lg transition-shadow">
                  <Link href="/vision">
                    <span className="truncate">Launch Application</span>
                  </Link>
                </Button>
              </div>
              <div className="relative">
                <div 
                  className="w-full aspect-[4/3] bg-cover bg-center rounded-2xl shadow-2xl" 
                  style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCaX4OmYpjLHgXLI5EyuAeqAkxVcGjI0OCBAtXBeooWkjG0FUP05xRXfi17eVfk7yJzPlfZxm-HaKIoGrJSW2AoF5Dh6Gq40yuAgEPQJQoqc2p2CLfHmSjztb8hpzGNfLmWP-lguoLHNPBJIz9jHWMwvfY7KuZYIGcmhPahYCpY6TjE4Gx_zv7_zL05sB7xhL4eDaE7aWQRB5DeExuLv6TDiOX32JO6wWAqL6q-R4Yeqis5h14u9032h1cwhPqktXP_IoUFuqzlWLIi")'}}
                  data-ai-hint="topographical map"
                ></div>
                <div className="absolute -bottom-8 -left-8 bg-white/70 backdrop-blur-md p-4 rounded-lg shadow-lg">
                  <p className="text-sm font-semibold text-[var(--c-charcoal)]">Total Area</p>
                  <p className="text-2xl font-bold text-[var(--c-green)]">15.7 Acres</p>
                </div>
                <div className="absolute -top-8 -right-8 bg-white/70 backdrop-blur-md p-4 rounded-lg shadow-lg">
                  <p className="text-sm font-semibold text-[var(--c-charcoal)]">Max Slope</p>
                  <p className="text-2xl font-bold text-[var(--c-green)]">28.5%</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
