
'use server';
/**
 * @fileOverview A Genkit flow for finding nearby points of interest using the Google Maps Places API.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  Client,
  PlaceType2,
  Place,
} from '@googlemaps/google-maps-services-js';
import * as turf from '@turf/turf';

const FindNearbyPlacesInputSchema = z.object({
  lat: z.number().describe('Latitude of the center point.'),
  lng: z.number().describe('Longitude of the center point.'),
});

const PlaceInfoSchema = z.object({
  name: z.string(),
  distanceKm: z.string(),
  distanceMiles: z.string(),
});

const FindNearbyPlacesOutputSchema = z.object({
  airport: PlaceInfoSchema.optional(),
  town: PlaceInfoSchema.optional(),
});
export type FindNearbyPlacesOutput = z.infer<
  typeof FindNearbyPlacesOutputSchema
>;


const findPlaceTool = ai.defineTool(
  {
    name: 'findPlace',
    description: 'Finds the nearest place of a given type and returns its details.',
    inputSchema: z.object({
      location: FindNearbyPlacesInputSchema,
      type: z.nativeEnum(PlaceType2),
    }),
    outputSchema: PlaceInfoSchema,
  },
  async ({ location, type }) => {
    const mapsClient = new Client({});
    try {
      const response = await mapsClient.placesNearby({
        params: {
          location,
          radius: 50000, // 50km search radius
          type,
          rankby: 'distance',
          key: process.env.GOOGLE_MAPS_API_KEY!,
        },
      });

      if (response.data.results && response.data.results.length > 0) {
        const place: Place = response.data.results[0];
        const placeLocation = place.geometry!.location;

        const from = turf.point([location.lng, location.lat]);
        const to = turf.point([placeLocation.lng, placeLocation.lat]);
        const distanceKm = turf.distance(from, to, { units: 'kilometers' });
        const distanceMiles = turf.distance(from, to, { units: 'miles' });
        
        return {
          name: place.name || 'Unknown',
          distanceKm: distanceKm.toFixed(1),
          distanceMiles: distanceMiles.toFixed(1),
        };
      }
      throw new Error(`No places of type ${type} found.`);
    } catch (e: any) {
      console.error(`Error finding place of type ${type}:`, e.message);
      throw e;
    }
  }
);


const findNearbyPlacesFlow = ai.defineFlow(
  {
    name: 'findNearbyPlacesFlow',
    inputSchema: FindNearbyPlacesInputSchema,
    outputSchema: FindNearbyPlacesOutputSchema,
  },
  async (location) => {
    let airport, town;
    
    try {
      airport = await findPlaceTool({ location, type: PlaceType2.airport });
    } catch (e) {
      console.log("Could not find a nearby airport.");
    }
    
    try {
       town = await findPlaceTool({ location, type: PlaceType2.locality });
    } catch (e) {
       console.log("Could not find a nearby town.");
    }

    return { airport, town };
  }
);

export async function findNearbyPlaces(
  input: z.infer<typeof FindNearbyPlacesInputSchema>
): Promise<FindNearbyPlacesOutput> {
  return findNearbyPlacesFlow(input);
}
