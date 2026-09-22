import tracer from "dd-trace";
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { config, BEDROCK_MODEL_ID } from "./config.js";
import {
  BEDROCK_HAIKU_INPUT_PER_TOKEN,
  BEDROCK_HAIKU_OUTPUT_PER_TOKEN,
  type ChatMessage,
  type BedrockResult,
} from "@dnd-adventures/shared-types";
import { DM_SYSTEM_PROMPT } from "./promptBuilder.js";

// Re-export prompt content for backward compatibility — callers importing from
// bedrock.ts will continue to work without changes.
export { DM_SYSTEM_PROMPT, buildMultiplayerSystemPrompt } from "./promptBuilder.js";

export type { ChatMessage, BedrockResult };

const client = new BedrockRuntimeClient({ region: config.AWS_REGION || "us-east-1" });

const MODEL_ID = BEDROCK_MODEL_ID;
const BEDROCK_STREAM_TIMEOUT_MS = 45_000;

/**
 * Stream a Bedrock response, calling onChunk for each text delta.
 * Wrapped in a tracer.llmobs.trace() span so it appears in Datadog LLM Observability.
 * Returns the full accumulated text.
 */
export async function streamBedrockResponse(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  options?: { characterClass?: string; pronouns?: string; multiplayerPrompt?: string; loreContext?: string }
): Promise<BedrockResult> {
  return tracer.llmobs.trace(
    {
      kind: "llm",
      name: "bedrock.dm_response",
      modelName: MODEL_ID,
      modelProvider: "aws",
    },
    async (span) => {
      // multiplayerPrompt already includes the full DM_SYSTEM_PROMPT as its base
      const pronounClause = options?.pronouns
        ? `\n\nThe player uses ${options.pronouns} pronouns. ALWAYS use these pronouns (${options.pronouns}) when referring to the player's character. Never use other pronouns for the player character.`
        : '';

      const systemPrompt = options?.multiplayerPrompt
        ? options.multiplayerPrompt
        : options?.characterClass
          ? `${DM_SYSTEM_PROMPT}\n\n## Player Character\nThe player is a ${options.characterClass}. Reference their class naturally in narration (e.g. their fighting style, spells, abilities, or background). Tailor combat descriptions and skill checks to their class.${pronounClause}`
          : `${DM_SYSTEM_PROMPT}${pronounClause}`;

      // Build system content blocks — base prompt + optional lore context
      const systemBlocks: Array<{ text: string }> = [{ text: systemPrompt }];
      if (options?.loreContext) {
        systemBlocks.push({
          text: `## Lore Context (from knowledge graph)\nUse the following retrieved lore to ground your response. Reference these details naturally — do not repeat them verbatim.\n\n${options.loreContext}`,
        });
      }

      const command = new ConverseStreamCommand({
        modelId: MODEL_ID,
        system: systemBlocks,
        messages: messages.map((m) => ({
          role: m.role,
          content: [{ text: m.content }],
        })),
      });

      const abortController = new AbortController();
      const timeoutId = setTimeout(
        () => abortController.abort(),
        BEDROCK_STREAM_TIMEOUT_MS
      );

      try {
        const response = await client.send(command, {
          abortSignal: abortController.signal,
        });

        if (!response.stream) {
          throw new Error("Bedrock response stream missing");
        }

        let fullText = "";
        let inputTokens = 0;
        let outputTokens = 0;

        for await (const chunk of response.stream) {
          const text = chunk.contentBlockDelta?.delta?.text;
          if (text) {
            fullText += text;
            onChunk(text);
          }
          if (chunk.metadata?.usage) {
            inputTokens = chunk.metadata.usage.inputTokens ?? 0;
            outputTokens = chunk.metadata.usage.outputTokens ?? 0;
          }
        }

        const costUsd =
          inputTokens * BEDROCK_HAIKU_INPUT_PER_TOKEN +
          outputTokens * BEDROCK_HAIKU_OUTPUT_PER_TOKEN;

        // Annotate BEFORE callback returns — span finishes on return
        tracer.llmobs.annotate(span, {
          inputData: messages.map((m) => ({ role: m.role, content: String(m.content) })),
          outputData: { role: "assistant", content: fullText },
          metrics: {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            costUsd,
          },
        });

        return { text: fullText, inputTokens, outputTokens };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(
            `Bedrock stream timed out after ${BEDROCK_STREAM_TIMEOUT_MS}ms`,
            { cause: error }
          );
        }

        if (error instanceof Error) {
          throw error;
        }

        throw new Error(`Bedrock stream failed: ${String(error)}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }
  );
}
