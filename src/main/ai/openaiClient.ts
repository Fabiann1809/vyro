import { z } from 'zod'
import { parseJsonAnswer } from './answer'
import { classifyError, LlmError } from './errors'
import type { GenerateRequest, LlmClient } from './llmClient'

export interface OpenAiConfig {
  // Without a trailing slash: "/chat/completions" is added to it.
  baseUrl: string
  // Null for a server that needs none, such as Ollama.
  apiKey: string | null
  model: string
}

const DEFAULT_TIMEOUT_MS = 90_000

interface ChatCompletion {
  choices?: Array<{
    message?: { content?: string | null }
    finish_reason?: string | null
  }>
}

// Talks to any server that speaks the OpenAI chat API: Groq, Gemini's compatible endpoint, Ollama.
// They differ in how well they keep to a JSON format, so the schema also goes in the prompt and
// the answer is always checked here.
export class OpenAiCompatibleClient implements LlmClient {
  constructor(
    private readonly config: OpenAiConfig,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS
  ) {}

  async generate<T>(request: GenerateRequest<T>): Promise<T> {
    const signal = AbortSignal.any([
      AbortSignal.timeout(this.timeoutMs),
      ...(request.signal ? [request.signal] : [])
    ])

    let response = await this.post(buildBody(this.config.model, request, true), signal)
    // Some servers do not know JSON mode and say so with a 400: ask once more without it.
    if (response.status === 400) {
      response = await this.post(buildBody(this.config.model, request, false), signal)
    }
    if (!response.ok) throw failureOf(response)

    return readAnswer(await readJson(response), request.schema)
  }

  private async post(body: unknown, signal: AbortSignal): Promise<Response> {
    try {
      return await this.fetchFn(`${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {})
        },
        body: JSON.stringify(body),
        signal
      })
    } catch (error) {
      throw classifyError(error)
    }
  }
}

function buildBody<T>(model: string, request: GenerateRequest<T>, jsonMode: boolean): unknown {
  const schema = JSON.stringify(z.toJSONSchema(request.schema))
  const system = `${request.system}\n\nAnswer with a single JSON object and nothing else, following this JSON Schema:\n${schema}`

  return {
    model,
    messages: [{ role: 'system', content: system }, ...request.messages],
    max_tokens: request.maxTokens,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
  }
}

function failureOf(response: Response): LlmError {
  const retryAfter = Number(response.headers.get('retry-after'))
  return classifyError(
    { status: response.status },
    Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}
  )
}

async function readJson(response: Response): Promise<ChatCompletion> {
  try {
    return (await response.json()) as ChatCompletion
  } catch {
    throw new LlmError('invalid-response', { issues: ['The server did not answer with JSON.'] })
  }
}

function readAnswer<T>(completion: ChatCompletion, schema: GenerateRequest<T>['schema']): T {
  const choice = completion.choices?.[0]
  const text = choice?.message?.content ?? ''

  if (choice?.finish_reason === 'content_filter') throw new LlmError('refused')
  if (choice?.finish_reason === 'length') throw new LlmError('truncated', { rawText: text })

  return parseJsonAnswer(text, schema)
}
