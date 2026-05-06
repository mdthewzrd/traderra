import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import OpenAI from 'openai';
import { NextRequest } from 'next/server';

// Create OpenAI client configured to use OpenRouter
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || 'your-api-key-here',
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
});

// Create the runtime
const runtime = new CopilotRuntime();

const serviceAdapter = new OpenAIAdapter({
  openai,
  model: "qwen/qwen-2.5-72b-instruct:free", // OpenRouter model format - cost-effective, high-quality
});

// Export the handlers for the API route
export const POST = async (req: NextRequest) => {
  try {
    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
      runtime: runtime,
      serviceAdapter: serviceAdapter,
      endpoint: '/api/copilotkit',
    });

    return handleRequest(req);
  } catch (error: any) {
    console.error('CopilotKit API Error:', error);
    return new Response(
      JSON.stringify({
        errors: [{
          message: error.message || 'Internal server error',
          extensions: { code: 'INTERNAL_ERROR' }
        }]
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Export GET handler for info endpoint
export const GET = async (req: NextRequest) => {
  const url = new URL(req.url);

  if (url.pathname === '/api/copilotkit/info') {
    return new Response(
      JSON.stringify({
        agent: 'default',
        version: '1.0.0',
        capabilities: ['analyzeCode', 'convertToV31', 'generateScanner', 'executeScan', 'optimizeParameters']
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ status: 'healthy' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
