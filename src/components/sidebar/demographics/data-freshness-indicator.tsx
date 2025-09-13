"use client";

interface DataFreshnessIndicatorProps {
  lastUpdated: string;
}

export function DataFreshnessIndicator({
  lastUpdated,
}: DataFreshnessIndicatorProps) {
  return (
    <p className="text-xs text-muted-foreground">Data updated: {lastUpdated}</p>
  );
}
