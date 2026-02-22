/**
 * LLM Client for BMAD Agents
 * Supports OpenAI, Anthropic, and local models
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface LLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

/**
 * Execute LLM call with system prompt
 */
export async function executeLLM(
  prompt: string,
  config: LLMConfig = {}
): Promise<LLMResponse> {
  const {
    model = 'gpt-4o-mini',
    temperature = 0.7,
    maxTokens = 2000,
    systemPrompt,
  } = config;

  const messages: any[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });

  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  const choice = response.choices[0];
  
  return {
    content: choice.message.content || '',
    usage: {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    },
    model: response.model,
  };
}

/**
 * Execute structured LLM call (returns JSON)
 */
export async function executeStructuredLLM<T>(
  prompt: string,
  schema: string,
  config: LLMConfig = {}
): Promise<T> {
  const structuredPrompt = `${prompt}

Respond with valid JSON matching this schema:
${schema}`;

  const response = await executeLLM(structuredPrompt, {
    ...config,
    temperature: 0.2, // Lower temp for structured output
  });

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/) ||
                     response.content.match(/```\n?([\s\S]*?)\n?```/) ||
                     [null, response.content];
    
    const jsonStr = jsonMatch[1].trim();
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    console.error('Failed to parse LLM response as JSON:', response.content);
    throw new Error(`Invalid JSON response: ${error}`);
  }
}