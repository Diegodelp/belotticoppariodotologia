const DEFAULT_MODEL = process.env.GOOGLE_GEMINI_MODEL ?? 'models/gemini-1.5-flash-latest';
const API_BASE = process.env.GOOGLE_GEMINI_API_BASE ?? 'https://generativelanguage.googleapis.com/v1beta';

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

export async function generateGeminiContent(apiKey: string, prompt: string, options: GenerateOptions = {}) {
  const sanitizedKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!sanitizedKey) {
    throw new Error('Necesitás una API key de Google AI Studio para generar contenido con Gemini.');
  }

  const model = options.model ?? DEFAULT_MODEL;
  const temperature = options.temperature ?? 0.4;
  const endpoint = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(sanitizedKey)}`;

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
    throw new Error(`Gemini devolvió un error ${response.status}: ${errorPayload}`);
  }

  const payload = (await response.json()) as GenerateResponsePayload;
  const text = (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();

  return { text, model };
}
