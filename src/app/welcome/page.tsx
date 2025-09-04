
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Loader2, Plus, LogOut } from 'lucide-react';
import { ProjectCard } from '@/components/welcome/project-card';
import type { Shape } from '@/lib/types';


interface Project {
    id: string;
    siteName: string;
    shapes: Shape[];
    lastModified: Date;
}

export default function WelcomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchProject = async () => {
      if (user) {
        setIsLoadingProject(true);
        try {
            const userDocRef = doc(db, 'projects', user.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProject({
                    id: user.uid,
                    siteName: data.siteName || 'My Project',
                    shapes: data.shapes || [],
                    lastModified: data.mapState?.center ? new Date() : new Date(0), // Placeholder logic
                });
            }
        } catch (error) {
            console.error("Failed to fetch project:", error);
        } finally {
            setIsLoadingProject(false);
        }
      }
    };

    fetchProject();
  }, [user]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/');
  };
  
  if (loading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-10 w-10 animate-spin" />
        </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
            <div className="flex items-center gap-3">
                <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path clipRule="evenodd" d="M12.0799 24L4 19.2479L9.95537 8.75216L18.04 13.4961L18.0446 4H29.9554L29.96 13.4961L38.0446 8.75216L44 19.2479L35.92 24L44 28.7521L38.0446 39.2479L29.96 34.5039L29.9554 44H18.0446L18.04 34.5039L9.95537 39.2479L4 28.7521L12.0799 24Z" fill="currentColor" fillRule="evenodd"></path>
                </svg>
                <h2 className="text-2xl font-bold tracking-tight">LandVision</h2>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                    {user?.email}
                </span>
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                    <LogOut className="h-5 w-5" />
                </Button>
            </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8">
            <div className="mx-auto max-w-7xl">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
                    <Button asChild>
                        <Link href="/vision">
                            <Plus className="-ml-1 mr-2 h-5 w-5" />
                            New Project
                        </Link>
                    </Button>
                </div>

                <div className="mt-8">
                    {isLoadingProject ? (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            <ProjectCard.Skeleton />
                            <ProjectCard.Skeleton />
                            <ProjectCard.Skeleton />
                        </div>
                    ) : project ? (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                           <ProjectCard project={project} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
                            <h3 className="text-xl font-medium">No projects yet</h3>
                            <p className="mt-2 text-sm text-muted-foreground">Get started by creating your first project.</p>
                            <Button asChild className="mt-6">
                                <Link href="/vision">
                                    <Plus className="-ml-1 mr-2 h-5 w-5" />
                                    Create New Project
                                </Link>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    </div>
  );
}
