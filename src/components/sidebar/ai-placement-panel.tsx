
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { suggestBuildingPlacement, type AISuggestBuildingPlacementOutput } from '@/ai/flows/ai-suggest-building-placement';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Loader2, Sparkles } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

const formSchema = z.object({
  propertyDetails: z.string().min(10, {
    message: 'Property details must be at least 10 characters.',
  }),
  zoningRegulations: z.string().min(10, {
    message: 'Zoning regulations must be at least 10 characters.',
  }),
});

export function AiPlacementPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AISuggestBuildingPlacementOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyDetails: '',
      zoningRegulations: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const placement = await suggestBuildingPlacement(values);
      setResult(placement);
    } catch (e) {
      setError('An error occurred while generating suggestions. Please try again.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>AI Placement Advisor</span>
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
        <CardDescription>
          Get AI-powered building placement ideas based on text descriptions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="propertyDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Details</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., 5-acre lot, gentle south slope, stream on west boundary..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="zoningRegulations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zoning Regulations</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., 20-foot setbacks, max height of 35 feet, no structures near stream..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-4 w-4" />
                  Get Suggestions
                </>
              )}
            </Button>
          </form>
        </Form>

        {error && <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md">{error}</div>}

        {result && (
          <div className="mt-4 space-y-4">
            <h3 className="font-semibold text-base">Suggestions</h3>
            <ScrollArea className="h-40 p-3 border rounded-md bg-muted/30">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm">Suggested Placements</h4>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{result.suggestedPlacements}</p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm">Reasoning</h4>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{result.reasoning}</p>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
    