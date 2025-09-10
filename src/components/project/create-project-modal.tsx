"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectNameStep } from "./project-name-step";
import { ProjectLocationStep } from "./project-location-step";
import { ProjectDetailsStep } from "./project-details-step";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProjectData {
  name?: string;
  location?: string;
  coordinates?: { lat: number; lng: number };
  projectType?: string;
  areaSize?: string;
  startDate?: string;
}

export function CreateProjectModal({
  isOpen,
  onClose,
}: CreateProjectModalProps) {
  const [step, setStep] = useState(1);
  const [projectData, setProjectData] = useState<ProjectData>({});
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleNext = (data: any) => {
    setProjectData({ ...projectData, ...data });
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleFinish = async (data: any) => {
    if (!user) return;

    setIsCreating(true);
    const finalProjectData = { ...projectData, ...data };

    try {
      // Create the project in Firestore
      const projectsRef = collection(db, "users", user.uid, "projects");
      const docRef = await addDoc(projectsRef, {
        siteName: finalProjectData.name,
        location: finalProjectData.location,
        coordinates: finalProjectData.coordinates,
        projectType: finalProjectData.projectType,
        areaSize: finalProjectData.areaSize,
        startDate: finalProjectData.startDate,
        shapes: [],
        lastModified: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      toast({
        title: "Project Created",
        description: `${finalProjectData.name} has been created successfully.`,
      });

      // Close modal and navigate to vision page with the new project
      onClose();

      // Navigate to vision page with coordinates for initial map view
      const params = new URLSearchParams({
        projectId: docRef.id,
      });

      if (finalProjectData.coordinates) {
        params.append("lat", finalProjectData.coordinates.lat.toString());
        params.append("lng", finalProjectData.coordinates.lng.toString());
        params.append("zoom", "16");
      }

      router.push(`/vision?${params.toString()}`);
    } catch (error) {
      console.error("Error creating project:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create project. Please try again.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setStep(1);
      setProjectData({});
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Project - Step {step} of 3</DialogTitle>
        </DialogHeader>
        {step === 1 && <ProjectNameStep onNext={handleNext} />}
        {step === 2 && (
          <ProjectLocationStep onNext={handleNext} onBack={handleBack} />
        )}
        {step === 3 && (
          <ProjectDetailsStep
            onFinish={handleFinish}
            onBack={handleBack}
            isLoading={isCreating}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
