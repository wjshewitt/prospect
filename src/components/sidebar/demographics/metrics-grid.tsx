import React from "react";
import MetricCard from "./metric-card";
import { cn } from "@/lib/utils";

interface Metric {
  title: string;
  value: string | number;
  nationalAverage: number;
  unit?: "%" | "£" | "km²" | "years" | "people";
}

interface MetricsGridProps {
  metrics: Metric[];
  className?: string;
}

export default function MetricsGrid({ metrics, className }: MetricsGridProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4", className)}>
      {metrics.map((metric, index) => (
        <MetricCard
          key={index}
          title={metric.title}
          value={metric.value}
          nationalAverage={metric.nationalAverage}
          unit={metric.unit}
        />
      ))}
    </div>
  );
}
