"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
  startAfter,
  DocumentData,
  QueryDocumentSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import {
  Loader2,
  Plus,
  LogOut,
  MoreHorizontal,
  Trash2,
  X,
  Edit,
} from "lucide-react";
import { ProjectCard } from "@/components/welcome/project-card";
import { CreateProjectModal } from "@/components/project/create-project-modal";
import { useToast } from "@/hooks/use-toast";
import type { Shape } from "@/lib/types";

interface Project {
  id: string;
  siteName: string;
  location?: string;
  shapes: Shape[];
  lastModified: string;
}

export default function WelcomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const PAGE_SIZE = 12;

  const fetchProjects = useCallback(
    async (isLoadMore: boolean = false) => {
      if (!user) return;
      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingProjects(true);
      }
      try {
        const projectsCollectionRef = collection(
          db,
          "users",
          user.uid,
          "projects"
        );
        let qBase = query(
          projectsCollectionRef,
          orderBy("lastModified", "desc"),
          limit(PAGE_SIZE)
        );
        if (isLoadMore && lastDoc) {
          qBase = query(
            projectsCollectionRef,
            orderBy("lastModified", "desc"),
            startAfter(lastDoc),
            limit(PAGE_SIZE)
          );
        }
        const querySnapshot = await getDocs(qBase);
        const userProjects: Project[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          userProjects.push({
            id: doc.id,
            siteName: data.siteName || "Untitled Project",
            location: data.location,
            shapes: data.shapes || [],
            lastModified: data.lastModified,
          });
        });
        const newLastDoc =
          querySnapshot.docs[querySnapshot.docs.length - 1] || null;
        setLastDoc(newLastDoc);
        setProjects((prev) =>
          isLoadMore ? [...prev, ...userProjects] : userProjects
        );
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        if (isLoadMore) {
          setIsLoadingMore(false);
        } else {
          setIsLoadingProjects(false);
        }
      }
    },
    [user, lastDoc]
  );

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    fetchProjects(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedProjects([]);
    setIsEditMode(false);
  };

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    setSelectedProjects([]);
    setIsSelectionMode(false);
  };

  const handleEditSelected = () => {
    if (selectedProjects.length === 1) {
      // Navigate to vision page with the selected project
      router.push(`/vision?projectId=${selectedProjects[0]}`);
    }
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleDeleteSelected = async () => {
    if (!user || selectedProjects.length === 0) return;

    setIsDeleting(true);
    try {
      // Delete all selected projects
      await Promise.all(
        selectedProjects.map((projectId) =>
          deleteDoc(doc(db, "users", user.uid, "projects", projectId))
        )
      );

      // Update local state
      setProjects((prev) =>
        prev.filter((p) => !selectedProjects.includes(p.id))
      );
      setSelectedProjects([]);
      setIsSelectionMode(false);

      toast({
        title: "Projects Deleted",
        description: `${selectedProjects.length} project${
          selectedProjects.length > 1 ? "s" : ""
        } deleted successfully.`,
      });
    } catch (error) {
      console.error("Error deleting projects:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete projects. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-3">
            <svg
              className="h-8 w-8 text-primary"
              fill="none"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                clipRule="evenodd"
                d="M12.0799 24L4 19.2479L9.95537 8.75216L18.04 13.4961L18.0446 4H29.9554L29.96 13.4961L38.0446 8.75216L44 19.2479L35.92 24L44 28.7521L38.0446 39.2479L29.96 34.5039L29.9554 44H18.0446L18.04 34.5039L9.95537 39.2479L4 28.7521L12.0799 24Z"
                fill="currentColor"
                fillRule="evenodd"
              ></path>
            </svg>
            <h2 className="text-2xl font-bold tracking-tight text-c-charcoal">
              LandVision
            </h2>
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
              <div className="flex items-center gap-2">
                {projects.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectionMode}
                  >
                    <MoreHorizontal className="h-4 w-4 mr-2" />
                    {isSelectionMode ? "Cancel" : "Select"}
                  </Button>
                )}
                <Button onClick={() => setIsModalOpen(true)}>
                  <Plus className="-ml-1 mr-2 h-5 w-5" />
                  New Project
                </Button>
              </div>
            </div>

            {(isSelectionMode || isEditMode) && (
              <div className="mt-4 p-4 bg-muted rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    {selectedProjects.length} project
                    {selectedProjects.length !== 1 ? "s" : ""} selected
                  </span>
                  {isEditMode && selectedProjects.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedProjects.length === 1
                        ? "Click 'Edit Project' to open in the editor."
                        : "Select only one project to edit."}
                    </p>
                  )}
                  {isSelectionMode && selectedProjects.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      To edit project boundaries, open the project in the
                      editor.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditMode && selectedProjects.length === 1 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleEditSelected}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Project
                    </Button>
                  )}
                  {isSelectionMode && selectedProjects.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelected}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {isDeleting ? "Deleting..." : "Delete Selected"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={isEditMode ? toggleEditMode : toggleSelectionMode}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-8 space-y-6">
              {isLoadingProjects ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <ProjectCard.Skeleton key={i} />
                  ))}
                </div>
              ) : projects.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {projects.map((p) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        isSelectionMode={isSelectionMode || isEditMode}
                        isSelected={selectedProjects.includes(p.id)}
                        onToggleSelect={() => toggleProjectSelection(p.id)}
                      />
                    ))}
                  </div>
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      disabled={isLoadingMore || !lastDoc}
                      onClick={() => fetchProjects(true)}
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                          Loading...
                        </>
                      ) : lastDoc ? (
                        "Load More"
                      ) : (
                        "All caught up"
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-white/50 p-12 text-center">
                  <h3 className="text-xl font-medium">No projects yet</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Get started by creating your first project.
                  </p>
                  <Button className="mt-6" onClick={() => setIsModalOpen(true)}>
                    <Plus className="-ml-1 mr-2 h-5 w-5" />
                    Create New Project
                  </Button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
