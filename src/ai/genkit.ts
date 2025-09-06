import {genkit, Flow} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {FunctionDeclaration, GenerationRequest} from '@genkit-ai/googleai/api';

// Monkey-patch a `defineFlow` method on the `ai` object.
interface PatchedAi {
  <Request, Response, Stream>(
    name: string,
    options: {
      inputSchema: any;
      outputSchema: any;
    },
    logic: (input: Request) => Promise<Response>
  ): Flow<Request, Response, Stream>;
}

export const ai = Object.assign(genkit, {
  defineFlow: function (a: any, b: any, c?: any) {
    if (c) {
      return (genkit as any).flow(a, b, c);
    }
    return (genkit as any).flow(a, b);
  },
  defineTool: function (a: any, b: any, c?: any) {
    if (c) {
      return (genkit as any).tool(a, b, c);
    }
    return (genkit as any).tool(a, b);
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
      flow: (genkit as any).flow(name, inputSchema, outputSchema, fn),
    });
  },
});
