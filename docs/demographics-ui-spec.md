# Demographics Panel UI Redesign Specification

This document outlines the architecture and component design for the redesigned Demographics Panel.

## 1. Overall Structure

The new `DemographicsPanelV2` will be the main container, responsible for fetching data and managing the overall loading, empty, and error states. It will be composed of smaller, reusable sub-components.

```
DemographicsPanelV2
├── DemographicPanelHeader
├── DataFreshnessIndicator
├── main content
|  ├── when loading: DemographicSkeleton
|  └── when data:
|      ├── DemographicMetricsGrid
|      |   ├── MetricCard (reusable)
|      |   └── ...
|      ├── AgeDistributionCard
|      |   └── AgeDistributionChart (interactive)
|      └── SourceAttribution
└── when no data: EmptyState
```

## 2. Component Breakdown & Props

### `DemographicsPanelV2`

- **Responsibility:** Main container, data fetching orchestrator.
- **State:** `isLoading`, `error`, `demographicData`.
- **Props:**
  ```typescript
  interface DemographicsPanelV2Props {
    siteId: string;
    siteName: string;
  }
  ```

### `DemographicPanelHeader`

- **Responsibility:** Displays the title and site name.
- **Props:**
  ```typescript
  interface DemographicPanelHeaderProps {
    siteName: string;
  }
  ```

### `DataFreshnessIndicator`

- **Responsibility:** Displays when the data was last updated and its quality.
- **Props:**

  ```typescript
  type DataQuality = "good" | "moderate" | "poor" | "unknown";

  interface DataFreshnessIndicatorProps {
    timestamp: string | null;
    quality: DataQuality;
    sourceName: string | null;
  }
  ```

### `DemographicMetricsGrid`

- **Responsibility:** Lays out the primary demographic statistics in a grid.
- **Props:**
  ```typescript
  interface DemographicMetricsGridProps {
    demographicData: DemographicData;
  }
  ```

### `MetricCard` (Reusable)

- **Responsibility:** Displays a single demographic metric with its label, value, national comparison, and a data quality/trend indicator. This will be a flexible component used for income, employment, education, etc.
- **Props:**
  ```typescript
  interface MetricCardProps {
    label: string;
    value: number | string | null;
    unit?: string;
    nationalValue?: number | string | null;
    nationalUnit?: string;
    trend?: "up" | "down" | "neutral";
    quality: DataQuality;
    insight?: string;
    icon: React.ReactNode;
  }
  ```

### `AgeDistributionCard`

- **Responsibility:** Container for the age distribution chart. Will handle a title and potentially an expand/collapse interaction.
- **Props:**
  ```typescript
  interface AgeDistributionCardProps {
    ageDistribution: DemographicData["ageDistribution"];
    nationalAgeDistribution?: DemographicData["nationalAverages"]["ageDistribution"];
  }
  ```

### `AgeDistributionChart`

- **Responsibility:** An interactive chart (e.g., bar chart) showing age brackets. It will support tooltips on hover to show exact percentages and comparisons.
- **Props:**
  ```typescript
  interface AgeDistributionChartProps {
    localData: {
      _0_17?: number;
      _18_34?: number;
      _35_64?: number;
      _65_plus?: number;
    };
    nationalData?: {
      _0_17?: number;
      _18_34?: number;
      _35_64?: number;
      _65_plus?: number;
    };
  }
  ```

### `SourceAttribution`

- **Responsibility:** Displays the data source(s) and a link for more information.
- **Props:**
  ```typescript
  interface SourceAttributionProps {
    sources: { name: string; url?: string }[];
  }
  ```

### `DemographicSkeleton`

- **Responsibility:** Provides a loading state UI that mimics the final layout, improving perceived performance. Will use shimmering placeholder elements.

### `EmptyState`

- **Responsibility:** A clear and helpful message shown when no demographic data is available for the selected location.

## 3. Interaction Patterns

- **Hovering on Metric Cards:** A tooltip will reveal a more detailed insight or data quality explanation.
- **Hovering on Age Distribution Chart:** Bars will highlight, and a tooltip will show the exact local percentage, and the national average if available.
- **Responsiveness:** The `DemographicMetricsGrid` will adjust its column count based on the available width (e.g., 1 column on narrow screens, 2-3 on wider screens).

## 4. Accessibility

- All interactive elements will be keyboard-navigable.
- `aria-` attributes will be used to describe chart data and dynamic content to screen readers.
- Proper heading structure will be used.

---

This plan provides a solid foundation. Next, I will ask for a mode switch to start implementing these components.
