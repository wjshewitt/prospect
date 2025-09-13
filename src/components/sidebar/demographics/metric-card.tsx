import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  nationalAverage: number;
  unit?: "%" | "£" | "km²" | "years" | "people";
  comparison?: "higher" | "lower";
}

const formatValue = (value: string | number, unit?: string) => {
  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numericValue)) return value;

  if (unit === "£") return `£${numericValue.toLocaleString()}`;
  if (unit === "years") return `${numericValue.toFixed(1)} years`;

  return `${numericValue.toLocaleString()}${unit === "%" ? "%" : ""}`;
};

const getTrendIndicator = (currentValue: number, nationalAverage: number) => {
  if (currentValue > nationalAverage) {
    return {
      text: "Above national average",
      className: "text-green-600",
    };
  }
  if (currentValue < nationalAverage) {
    return {
      text: "Below national average",
      className: "text-red-600",
    };
  }
  return {
    text: "Matches national average",
    className: "text-gray-500",
  };
};

export default function MetricCard({
  title,
  value,
  nationalAverage,
  unit,
}: MetricCardProps) {
  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  const trend = getTrendIndicator(numericValue, nationalAverage);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{formatValue(value, unit)}</div>
        <p className={cn("text-xs", trend.className)}>{trend.text}</p>
      </CardContent>
      <CardFooter>
        <div className="text-xs text-gray-500">
          National Average: {formatValue(nationalAverage, unit)}
        </div>
      </CardFooter>
    </Card>
  );
}
