
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { suggestBuildingPlacement, type AISuggestBuildingPlacementOutput } from '@/ai/flows/ai-suggest-building-placement';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
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

export function BuildingPlacementDialog() {
  const [isOpen, setIsOpen] = useState(false);
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" className="w-full h-14 justify-center">
            <Bot />
          </Button>
        </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary h-5 w-5" />
            AI Building Placement Suggestions
          </DialogTitle>
          <DialogDescription>
            Describe your property and its zoning rules to get AI-powered building placement ideas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
                        placeholder="e.g., 5-acre rectangular lot, gentle slope to the south, a small stream along the western boundary, dense woods in the northern corner."
                        {...field}
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
                        placeholder="e.g., Residential R-1, 20-foot setbacks from all property lines, max building height of 35 feet, no structures allowed within 50 feet of the stream."
                        {...field}
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
                  'Get Suggestions'
                )}
              </Button>
            </form>
          </Form>

          {error && <div className="text-destructive text-sm p-4 bg-destructive/10 rounded-md">{error}</div>}

          {result && (
            <div className="mt-4 space-y-4">
              <h3 className="font-semibold text-lg">Suggestions</h3>
              <ScrollArea className="h-48 p-4 border rounded-md bg-muted/30">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">Suggested Placements</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.suggestedPlacements}</p>
                  </div>
                  <div>
                    <h4 className="font-medium">Reasoning</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.reasoning}</p>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

