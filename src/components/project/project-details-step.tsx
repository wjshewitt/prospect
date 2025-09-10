"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProjectDetailsStepProps {
  onFinish: (data: {
    projectType: string;
    areaSize: string;
    startDate: string;
  }) => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function ProjectDetailsStep({
  onFinish,
  onBack,
  isLoading = false,
}: ProjectDetailsStepProps) {
  const [projectType, setProjectType] = useState("");
  const [areaSize, setAreaSize] = useState("");
  const [startDate, setStartDate] = useState("");

  const handleFinish = () => {
    onFinish({ projectType, areaSize, startDate });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="projectType">Project Type</Label>
        <Input
          id="projectType"
          value={projectType}
          onChange={(e) => setProjectType(e.target.value)}
          placeholder="e.g., Residential Development, Commercial Complex"
          disabled={isLoading}
        />
      </div>
      <div>
        <Label htmlFor="areaSize">Area Size</Label>
        <Input
          id="areaSize"
          value={areaSize}
          onChange={(e) => setAreaSize(e.target.value)}
          placeholder="e.g., 5 acres, 2000 sq ft"
          disabled={isLoading}
        />
      </div>
      <div>
        <Label htmlFor="startDate">Start Date</Label>
        <Input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          Back
        </Button>
        <Button onClick={handleFinish} disabled={isLoading}>
          {isLoading ? "Creating Project..." : "Finish"}
        </Button>
      </div>
    </div>
  );
}
