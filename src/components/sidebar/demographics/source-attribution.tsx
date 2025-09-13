"use client";

interface SourceAttributionProps {
  source: string;
}

export function SourceAttribution({ source }: SourceAttributionProps) {
  return (
    <p className="text-xs text-muted-foreground">Data provided by {source}</p>
  );
}
