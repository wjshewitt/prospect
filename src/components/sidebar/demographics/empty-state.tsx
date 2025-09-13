import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center space-y-4 p-8">
        <Info className="h-12 w-12 text-gray-400" />
        <p className="text-center text-gray-500">{message}</p>
      </CardContent>
    </Card>
  );
}
