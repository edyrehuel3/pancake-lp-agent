import OpenAI from "openai";
import { config } from "./config.js";
import { buildPrompt } from "./prompt.js";
import { log } from "./logger.js";
import { executeTool } from "./tools/executor.js";
import { tools } from "./tools/definitions.js";

let _openai = null;

function getClient() {
  if (!_openai) {
    const baseURL = process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
    const apiKey = process.env.OPENROUTER_API_KEY || "sk-or-...";
    _openai = new OpenAI({ baseURL, apiKey });
  }
  return _openai;
}

export async function runAgentCycle({ role = "MANAGER", extra = "", maxSteps = null }) {
  const model = role === "SCREENER" ? config.llm.screeningModel : role === "MANAGER" ? config.llm.managementModel : config.llm.generalModel;
  const systemPrompt = buildPrompt(role, extra);
  const steps = maxSteps || config.llm.maxSteps;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Run your ${role.toLowerCase()} cycle now. Analyze the current state and take appropriate actions.` },
  ];

  const client = getClient();
  let stepCount = 0;

  while (stepCount < steps) {
    stepCount++;
    log("agent", `[${role}] Step ${stepCount}/${steps}`);

    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        tools,
        temperature: config.llm.temperature,
        max_tokens: config.llm.maxTokens,
      });

      const choice = response.choices?.[0];
      if (!choice) {
        log("agent", "No response from LLM");
        break;
      }

      const message = choice.message;

      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push({ role: "assistant", content: message.content || null, tool_calls: message.tool_calls });

        for (const toolCall of message.tool_calls) {
          let args;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            args = {};
          }

          log("agent", `[${role}] Calling: ${toolCall.function.name}`);
          const result = await executeTool(toolCall.function.name, args);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: typeof result === "string" ? result : JSON.stringify(result),
          });
        }
      } else {
        messages.push({ role: "assistant", content: message.content || "" });
        return {
          role,
          reasoning: message.content || "",
          steps: stepCount,
          model,
          finish_reason: choice.finish_reason,
        };
      }
    } catch (error) {
      log("agent_error", `[${role}] Error: ${error.message}`);
      return {
        role,
        error: error.message,
        steps: stepCount,
        model,
      };
    }
  }

  return {
    role,
    error: `Max steps (${steps}) reached`,
    steps: stepCount,
    model,
  };
}

export async function chat(userMessage, role = "GENERAL") {
  const model = config.llm.generalModel;
  const systemPrompt = buildPrompt(role);
  const client = getClient();

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: config.llm.temperature,
    max_tokens: config.llm.maxTokens,
  });

  return response.choices?.[0]?.message?.content || "No response";
}
