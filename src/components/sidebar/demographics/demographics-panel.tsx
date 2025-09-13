"use client";

import { useEffect, useState } from "react";
import { DemographicSkeleton } from "./demographic-skeleton";
import { EmptyState } from "./empty-state";
import { NewDemographicData } from "./types";
import MetricsGrid from "./metrics-grid";
import { AgeDistributionCard } from "./age-distribution-card";
import { SourceAttribution } from "./source-attribution";
import { DataFreshnessIndicator } from "./data-freshness-indicator";

interface DemographicsPanelProps {
  siteId: string | null;
}

export function DemographicsPanel({ siteId }: DemographicsPanelProps) {
  const [data, setData] = useState<NewDemographicData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/ons/demographics?site_id=${siteId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch demographics data");
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [siteId]);

  if (loading) {
    return <DemographicSkeleton />;
  }

  if (error) {
    return <EmptyState message={error} />;
  }

  if (!data) {
    return (
      <EmptyState message="No demographic data available for this site." />
    );
  }

  const metrics = [
    {
      title: "Population",
      value: data.population.total,
      nationalAverage: 67000000,
      unit: "people" as const,
    },
    {
      title: "Employment Rate",
      value: data.employment.rate,
      nationalAverage: 75.5,
      unit: "%" as const,
    },
  ];

  return (
    <div className="space-y-4">
      <MetricsGrid metrics={metrics} />
      <AgeDistributionCard data={data.age_distribution} />
      <div className="flex justify-between items-center">
        <SourceAttribution source="UK Census 2021" />
        <DataFreshnessIndicator lastUpdated={data.lastUpdated} />
      </div>
    </div>
  );
}
