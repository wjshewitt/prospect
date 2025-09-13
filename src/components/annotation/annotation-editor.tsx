"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Annotation } from "@/lib/types";

interface AnnotationEditorProps {
  annotation: Partial<Annotation>;
  onSave: (annotation: Annotation) => void;
  onCancel: () => void;
}

export const AnnotationEditor: React.FC<AnnotationEditorProps> = ({
  annotation,
  onSave,
  onCancel,
}) => {
  const [content, setContent] = useState(annotation.content || "");

  const handleSave = () => {
    if (content.trim()) {
      onSave({
        ...annotation,
        content,
      } as Annotation);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Annotation</DialogTitle>
        </DialogHeader>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter annotation text..."
        />
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
