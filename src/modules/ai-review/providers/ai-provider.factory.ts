import { Injectable } from '@nestjs/common';
import { IAiProvider } from './ai-provider.interface';
import { AiProvider } from '../../../config/ai.config';
import { GeminiProvider } from './gemini.provider';
import { OpenAIProvider } from './openai.provider';

@Injectable()
export class AiProviderFactory {
  constructor(
    private geminiProvider: GeminiProvider,
    private openaiProvider: OpenAIProvider,
  ) {}

  getProvider(): IAiProvider {
    return this.openaiProvider;
  }

  getProviderByName(provider: AiProvider): IAiProvider {
    switch (provider) {
      case 'gemini':
        return this.geminiProvider;
      case 'openai':
      case 'gpt':
        return this.openaiProvider;
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }
}
