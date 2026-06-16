import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AiConfigService } from '../ai.config';

describe('AiConfigService', () => {
  it('returns forced model when OPENAI_FORCE_MODEL is set', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ OPENAI_FORCE_MODEL: 'gpt-4o-mini' })],
        }),
      ],
      providers: [AiConfigService],
    }).compile();

    const service = moduleRef.get(AiConfigService);
    expect(service.getModel()).toBe('gpt-4o-mini');
  });

  it('falls back to OPENAI_MODEL when no force model is set', async () => {
    // Ensure any process env override doesn't interfere
    const originalForced = process.env.OPENAI_FORCE_MODEL;
    const originalModel = process.env.OPENAI_MODEL;
    const originalProvider = process.env.AI_PROVIDER;
    process.env.OPENAI_FORCE_MODEL = '';
    process.env.OPENAI_MODEL = 'gpt-4';
    process.env.AI_PROVIDER = 'openai';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ OPENAI_MODEL: 'gpt-4', AI_PROVIDER: 'openai' })],
        }),
      ],
      providers: [AiConfigService],
    }).compile();

    const service = moduleRef.get(AiConfigService);
    expect(service.getModel()).toBe('gpt-4');

    // restore
    process.env.OPENAI_FORCE_MODEL = originalForced;
    process.env.OPENAI_MODEL = originalModel;
    process.env.AI_PROVIDER = originalProvider;
  });
});
