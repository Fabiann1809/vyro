import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { classifyError, LlmError } from './errors'
import type { GenerateRequest, LlmClient, ModelTier } from './llmClient'

// The only place that names Claude models. Sonnet for what must be right, Haiku for what is short.
export const CLAUDE_MODELS: Record<ModelTier, string> = {
  capable: 'claude-sonnet-5-5',
  fast: 'claude-haiku-5-5'
}

// Structured answers need little deliberation; more effort would only cost more.
const EFFORT: Record<ModelTier, 'low' | 'medium'> = { fast: 'low', capable: 'medium' }

export type ClaudeRequest = Anthropic.MessageCreateParamsNonStreaming
// Only the parts of the answer that are read, so a test can build one by hand.
export type ClaudeResponse = Pick<Anthropic.Message, 'content' | 'stop_reason'>
export type ClaudeTransport = (
  request: ClaudeRequest,
  options: { signal?: AbortSignal }
) => Promise<ClaudeResponse>

export interface SdkTransportOptions {
  timeoutMs?: number
  maxRetries?: number
  fetch?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 90_000

// The real transport. A client is made for each key, so a key the user just changed is used at once.
export function createSdkTransport(
  apiKey: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries, fetch }: SdkTransportOptions = {}
): ClaudeTransport {
  const client = new Anthropic({
    apiKey,
    timeout: timeoutMs,
    ...(maxRetries === undefined ? {} : { maxRetries }),
    ...(fetch ? { fetch } : {})
  })
  return (request, options) => client.messages.create(request, options)
}

function classifyClaudeError(error: unknown): LlmError {
  if (error instanceof Anthropic.APIUserAbortError) return new LlmError('cancelled')
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new LlmError('timeout')
  if (error instanceof Anthropic.APIConnectionError) return new LlmError('network')
  return classifyError(error)
}

export class ClaudeClient implements LlmClient {
  constructor(
    private readonly getKey: () => string | null,
    private readonly makeTransport: (apiKey: string) => ClaudeTransport = createSdkTransport
  ) {}

  async generate<T>(request: GenerateRequest<T>): Promise<T> {
    const key = this.getKey()
    if (!key) throw new LlmError('no-key')

    let response: ClaudeResponse
    try {
      response = await this.makeTransport(key)(buildRequest(request), { signal: request.signal })
    } catch (error) {
      throw classifyClaudeError(error)
    }
    return readAnswer(response, request.schema)
  }
}

function buildRequest<T>(request: GenerateRequest<T>): ClaudeRequest {
  return {
    model: CLAUDE_MODELS[request.tier],
    max_tokens: request.maxTokens,
    system: request.system,
    messages: request.messages,
    output_config: { effort: EFFORT[request.tier], format: zodOutputFormat(request.schema) }
  }
}

function readAnswer<T>(response: ClaudeResponse, schema: GenerateRequest<T>['schema']): T {
  if (response.stop_reason === 'refusal') throw new LlmError('refused')

  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
  if (response.stop_reason === 'max_tokens') throw new LlmError('truncated', { rawText: text })

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new LlmError('invalid-response', {
      rawText: text,
      issues: ['The answer is not valid JSON.']
    })
  }

  const parsed = schema.safeParse(json)
  if (parsed.success) return parsed.data

  const issues = parsed.error.issues.map(
    (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
  )
  throw new LlmError('invalid-response', { rawText: text, issues })
}
