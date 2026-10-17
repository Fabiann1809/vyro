import { AI_PROVIDERS, isSafeAiBaseUrl, type AiProviderId } from '@shared/aiProviders'
import { ClaudeClient } from './claudeClient'
import { LlmError } from './errors'
import type { GenerateRequest, LlmClient } from './llmClient'
import { OpenAiCompatibleClient } from './openaiClient'

export interface ProviderChoice {
  aiProvider: AiProviderId
  aiModel: string | null
  aiBaseUrl: string | null
}

// The client the rest of the app uses. The provider is read again on every request, so a change
// in Settings takes effect without restarting anything.
export class ConfiguredLlmClient implements LlmClient {
  constructor(
    private readonly getChoice: () => ProviderChoice,
    private readonly getKey: () => string | null,
    private readonly claude: LlmClient = new ClaudeClient(getKey),
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  generate<T>(request: GenerateRequest<T>): Promise<T> {
    const choice = this.getChoice()
    const preset = AI_PROVIDERS[choice.aiProvider]
    const key = this.getKey()
    if (preset.requiresKey && !key) return Promise.reject(new LlmError('no-key'))

    if (choice.aiProvider === 'claude') return this.claude.generate(request)

    const baseUrl = preset.baseUrl ?? choice.aiBaseUrl
    const model = choice.aiModel ?? preset.models[request.tier]
    // The address is checked here as well as when it is saved: this is where the key would leave.
    if (!baseUrl || !model || !isSafeAiBaseUrl(baseUrl)) {
      return Promise.reject(new LlmError('not-configured'))
    }
    return new OpenAiCompatibleClient({ baseUrl, model, apiKey: key }, this.fetchFn).generate(
      request
    )
  }
}
