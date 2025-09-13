"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, FolderOpen, ChevronDown, Loader2, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

interface Project {
  id: string;
  siteName: string;
  location?: string;
  lastModified: string;
}

interface SaveLoadDropdownProps {
  onSave: () => void;
  hasShapes: boolean;
  isSaving?: boolean;
  saveSuccess?: boolean;
}

export function SaveLoadDropdown({
  onSave,
  hasShapes,
  isSaving = false,
  saveSuccess = false,
}: SaveLoadDropdownProps) {
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLoadProjects = async () => {
    if (!user) return;

    setIsLoadingProjects(true);
    try {
      const projectsCollectionRef = collection(
        db,
        "users",
        user.uid,
        "projects"
      );
      const q = query(
        projectsCollectionRef,
        orderBy("lastModified", "desc"),
        limit(10)
      );
      const querySnapshot = await getDocs(q);

      const userProjects: Project[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        userProjects.push({
          id: doc.id,
          siteName: data.siteName || "Untitled Project",
          location: data.location,
          lastModified: data.lastModified,
        });
      });

      setProjects(userProjects);
      setIsLoadDialogOpen(true);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      toast({
        variant: "destructive",
        title: "Load Failed",
        description: "Could not load projects. Please try again.",
      });
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleLoadProject = (projectId: string) => {
    setIsLoadDialogOpen(false);
    router.push(`/vision?projectId=${projectId}`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 hover:bg-gradient-to-r hover:from-green-500 hover:to-orange-500 hover:text-white hover:border-green-500 transition-all duration-200"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Saving..." : "Project"}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Project Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSave} disabled={!hasShapes || isSaving}>
            <Save className="mr-2 h-4 w-4" />
            Save Project
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleLoadProjects}
            disabled={isLoadingProjects}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            {isLoadingProjects ? "Loading..." : "Load Project"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Load Project</DialogTitle>
            <DialogDescription>
              Select a project to open in the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {projects.length > 0 ? (
              <div className="grid gap-3">
                {projects.map((project) => {
                  const lastModifiedDate = project.lastModified
                    ? new Date(project.lastModified)
                    : null;
                  const timeAgo = lastModifiedDate
                    ? formatDistanceToNow(lastModifiedDate, { addSuffix: true })
                    : "never";

                  return (
                    <Card
                      key={project.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleLoadProject(project.id)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">
                          {project.siteName}
                        </CardTitle>
                        <CardDescription>
                          {project.location && (
                            <span className="block">{project.location}</span>
                          )}
                          Last modified {timeAgo}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No projects found</p>
                <p className="text-sm">Create a new project to get started.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
