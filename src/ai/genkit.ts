import {genkit, Flow} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {FunctionDeclaration, GenerationRequest} from '@genkit-ai/googleai/api';
import {z} from 'zod';

type FlowDefinition<Request, Response, Stream> = {
  name: string;
  inputSchema: z.ZodType<Request>;
  outputSchema: z.ZodType<Response>;
  streamSchema?: z.ZodType<Stream>;
};

// Monkey-patch a `defineFlow` method on the `ai` object.
interface PatchedAi {
  defineFlow: <Request, Response, Stream>(
    definition: FlowDefinition<Request, Response, Stream>,
    logic: (input: Request) => Promise<Response>
  ) => Flow<Request, Response, Stream>;
}

export const ai = Object.assign(genkit, {
  defineFlow: function (a: any, b: any, c?: any) {
    if (c) {
      return genkit.flow(a, b, c);
    }
    return genkit.flow(a, b);
  },
  defineTool: function (a: any, b: any, c?: any) {
    if (c) {
      return genkit.tool(a, b, c);
    }
    return genkit.tool(a, b);
  },
  definePrompt: function <
    Request extends Record<string, any>,
    Response extends Record<string, any>,
  >({
    name,
    input: {schema: inputSchema},
    output: {schema: outputSchema},
    prompt,
  }: {
    name: string;
    input: {schema: any};
    output: {schema: any};
    prompt: string;
  }) {
    const fn = async (req: Request) => {
      const model = 'googleai/gemini-1.5-flash';
      const genReq: GenerationRequest = {
        candidates: 1,
        model,
        tools: [],
        tool_config: undefined,
        system_instruction: undefined,
        output: {
          format: 'json',
          schema: outputSchema,
        },
        prompt: prompt,
      };

      const {candidates} = await ai.generate(genReq);

      if (!candidates.length) {
        throw new Error('No candidates returned');
      }
      return {
        output: candidates[0].output as any,
      };
    };
    return Object.assign(fn, {
      flow: genkit.flow(name, inputSchema, outputSchema, fn),
    });
  },
});
