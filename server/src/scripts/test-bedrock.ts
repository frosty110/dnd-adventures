/**
 * Standalone Bedrock smoke test — no server required.
 * Run: yarn workspace server test:bedrock
 *
 * Verifies:
 *   1. AWS credentials are valid
 *   2. Bedrock model access is enabled in your region
 *   3. Claude responds in character as a DM
 *   4. Streaming works (tokens print as they arrive)
 */
import "dotenv/config";
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { config } from "../services/config.js";

const MODEL_ID =
  config.BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0";

console.log(`\nTesting Bedrock...`);
console.log(`Region : ${config.AWS_REGION || "us-east-1"}`);
console.log(`Model  : ${MODEL_ID}`);
console.log(`─────────────────────────────\n`);

const client = new BedrockRuntimeClient({
  region: config.AWS_REGION || "us-east-1",
});

const command = new ConverseStreamCommand({
  modelId: MODEL_ID,
  system: [
    {
      text: "You are a Dungeon Master. Be brief — one sentence only.",
    },
  ],
  messages: [
    {
      role: "user",
      content: [{ text: "I enter the tavern." }],
    },
  ],
});

try {
  const response = await client.send(command);
  process.stdout.write("DM: ");

  for await (const chunk of response.stream!) {
    const text = chunk.contentBlockDelta?.delta?.text;
    if (text) process.stdout.write(text);
  }

  console.log("\n\nBedrock is working.\n");
} catch (err: unknown) {
  const error = err as { name?: string; message?: string };
  console.error("\nBedrock call failed:");
  console.error(`  ${error.name}: ${error.message}`);

  if (error.name === "UnrecognizedClientException") {
    console.error("\n  Fix: Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env");
  } else if (error.name === "AccessDeniedException") {
    console.error("\n  Fix: Enable model access in AWS console →");
    console.error("  https://console.aws.amazon.com/bedrock/home#/modelaccess");
  } else if (error.name === "ValidationException") {
    console.error("\n  Fix: Check BEDROCK_MODEL_ID in .env — model may not exist in your region");
  }

  process.exit(1);
}
