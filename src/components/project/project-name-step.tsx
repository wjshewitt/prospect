"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProjectNameStepProps {
  onNext: (data: { name: string }) => void;
}

export function ProjectNameStep({ onNext }: ProjectNameStepProps) {
  const [name, setName] = useState("");

  const handleNext = () => {
    if (name) {
      onNext({ name });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Project Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <Button onClick={handleNext} disabled={!name}>
        Next
      </Button>
    </div>
  );
}
