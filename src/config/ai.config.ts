import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AiProvider = 'gemini' | 'gpt' | 'openai';

export interface AiProviderConfig {
  provider: AiProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

@Injectable()
export class AiConfigService {
  constructor(private configService: ConfigService) {}

  getProvider(): AiProvider {
    const provider = this.configService.get<string>('AI_PROVIDER', 'gemini');
    if (provider === 'gpt' || provider === 'openai') {
      return 'openai';
    }
    return 'gemini';
  }

  getApiKey(): string {
    const provider = this.getProvider();
    if (provider === 'openai') {
      const key = this.configService.get<string>('OPENAI_API_KEY');
      if (!key) {
        throw new Error(
          'OPENAI_API_KEY environment variable is required when using OpenAI provider',
        );
      }
      return key;
    } else {
      const key = this.configService.get<string>('GEMINI_API_KEY');
      if (!key) {
        throw new Error(
          'GEMINI_API_KEY environment variable is required when using Gemini provider',
        );
      }
      return key;
    }
  }

  getModel(): string {
    // Allow an explicit override to force a specific OpenAI model regardless of provider
    const forced = this.configService.get<string>('OPENAI_FORCE_MODEL');
    if (forced && forced.trim() !== '') {
      return forced.trim();
    }

    const provider = this.getProvider();
    if (provider === 'openai') {
      return this.configService.get<string>('OPENAI_MODEL', 'gpt-4') || 'gpt-4';
    } else {
      return (
        this.configService.get<string>('GEMINI_MODEL', 'gemini-2.5-flash') ||
        'gemini-2.5-flash'
      );
    }
  }

  getBaseUrl(): string | undefined {
    const provider = this.getProvider();
    if (provider === 'openai') {
      return this.configService.get<string>('OPENAI_BASE_URL');
    } else {
      return this.configService.get<string>('GEMINI_BASE_URL');
    }
  }

  getConfig(): AiProviderConfig {
    return {
      provider: this.getProvider(),
      apiKey: this.getApiKey(),
      model: this.getModel(),
      baseUrl: this.getBaseUrl(),
    };
  }
}
