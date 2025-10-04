const DEFAULT_MODEL = process.env.GOOGLE_GEMINI_MODEL ?? 'models/gemini-1.5-flash';
const API_BASE = process.env.GOOGLE_GEMINI_API_BASE ?? 'https://generativelanguage.googleapis.com/v1beta';

const FALLBACK_MODELS = ['models/gemini-1.5-flash', 'models/gemini-1.5-flash-001'];

interface GenerateOptions {
  model?: string;
  temperature?: number;
}

interface GenerateResponsePayload {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export function getDefaultGeminiModel() {
  return DEFAULT_MODEL;
}

function buildModelCandidates(optionsModel?: string) {
  if (optionsModel) {
    return [optionsModel];
  }

  const configuredModel = process.env.GOOGLE_GEMINI_MODEL?.trim();
  const candidates: string[] = [];

  if (configuredModel) {
    candidates.push(configuredModel);
    if (configuredModel.endsWith('-latest')) {
      candidates.push(configuredModel.replace(/-latest$/, ''));
    }
  }

  candidates.push(DEFAULT_MODEL);
  for (const fallback of FALLBACK_MODELS) {
    candidates.push(fallback);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

async function requestContent(apiKey: string, prompt: string, model: string, temperature: number) {
  const endpoint = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
      },
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    const error = new Error(`Gemini devolvió un error ${response.status}: ${errorPayload}`);
    if (response.status === 404) {
      (error as Error & { code?: string }).code = 'MODEL_NOT_FOUND';
    }
    throw error;
  }

  const payload = (await response.json()) as GenerateResponsePayload;
  const text = (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();

  return { text, model };
}

export async function generateGeminiContent(apiKey: string, prompt: string, options: GenerateOptions = {}) {
  const sanitizedKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!sanitizedKey) {
    throw new Error('Necesitás una API key de Google AI Studio para generar contenido con Gemini.');
  }

  const temperature = options.temperature ?? 0.4;
  const candidates = buildModelCandidates(options.model);

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      return await requestContent(sanitizedKey, prompt, candidate, temperature);
    } catch (error) {
      lastError = error as Error;
      const code = (error as Error & { code?: string }).code;
      if (code === 'MODEL_NOT_FOUND' && !options.model) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error('No se pudo generar contenido con Gemini porque ningún modelo compatible respondió correctamente.');
}
