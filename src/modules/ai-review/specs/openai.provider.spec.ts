import { Test } from '@nestjs/testing';
import { OpenAIProvider } from '../providers/openai.provider';
import { AiConfigService } from '../../../config/ai.config';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockConfig: Partial<AiConfigService>;

  beforeEach(async () => {
    mockConfig = {
      getApiKey: () => 'test-key',
      getBaseUrl: () => 'https://api.openai.com/v1',
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        OpenAIProvider,
        { provide: AiConfigService, useValue: mockConfig },
      ],
    }).compile();

    provider = moduleRef.get(OpenAIProvider);
  });

  afterEach(() => {
    // @ts-ignore
    delete global.fetch;
  });

  it('uses responses API for gpt-4o models and parses output_text', async () => {
    (mockConfig as any).getModel = () => 'gpt-4o-mini';

    // mock fetch to simulate upload then responses API
    // First call: upload file -> returns id
    // Second call: responses -> returns output_text

    // @ts-ignore
    global.fetch = jest
      .fn()
      // 1. upload file -> returns id
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'file-1' }) })
      // 2. create vector store -> returns id
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'vs-1' }) })
      // 3. attach file to vector store
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      // 4. responses API -> returns output_text
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output_text:
            '{"q1":{"response":"OK","is_flagged":false,"confidence_score":80,"applicant_answer":"X"}}',
        }),
      });

    // create a dummy file to emulate an uploaded document
    const dummyPath = 'path/to/file.pdf';
    const fs = require('fs');
    try {
      fs.mkdirSync('path/to', { recursive: true });
    } catch (e) {}
    fs.writeFileSync(dummyPath, 'dummy');

    const result = await provider.analyzeAssessment(
      [
        {
          questionId: 'q1',
          questionText: 'Q',
          questionType: 'file',
          answerId: 'a1',
          responseType: 'pdf',
          responseValue: null,
        },
      ],
      { certificateName: 'C', organizationName: 'O' },
      [{ questionId: 'q1', filePath: dummyPath }],
    );

    expect(result['q1'].response).toBe('OK');
    expect(result['q1'].is_flagged).toBe(false);
    expect(result['q1'].confidence_score).toBe(80);

    // cleanup
    try {
      require('fs').unlinkSync(dummyPath);
    } catch (e) {}
  });

  it('uses chat completions API for non gpt-4o models', async () => {
    (mockConfig as any).getModel = () => 'gpt-4';

    // mock fetch to return chat-style response
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"response":"CHAT","is_flagged":true,"confidence_score":90,"applicant_answer":"Y"}',
            },
          },
        ],
      }),
    });

    const result = await provider.analyzeAnswer('Q', 'text', 'Answer', 'text');

    expect(result.response).toBe('CHAT');
    expect(result.is_flagged).toBe(true);
    expect(result.confidence_score).toBe(75);
  });

  it('uploads files for OpenAI even when model is non-gpt-4o and uses Responses API', async () => {
    (mockConfig as any).getModel = () => 'gpt-4';

    // First call: upload file
    // Second call: responses API
    // @ts-ignore
    global.fetch = jest
      .fn()
      // 1. upload file -> returns id
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'file-2' }) })
      // 2. create vector store -> returns id
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'vs-2' }) })
      // 3. attach file to vector store
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      // 4. responses API -> returns output_text
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output_text:
            '{"q1":{"response":"DOC","is_flagged":false,"confidence_score":88,"applicant_answer":"doc"}}',
        }),
      });

    // create dummy file
    const dummyPath2 = 'path/to/file2.pdf';
    const fs = require('fs');
    try {
      fs.mkdirSync('path/to', { recursive: true });
    } catch (e) {}
    fs.writeFileSync(dummyPath2, 'dummy');

    const result = await provider.analyzeAssessment(
      [
        {
          questionId: 'q1',
          questionText: 'Q',
          questionType: 'file',
          answerId: 'a1',
          responseType: 'pdf',
          responseValue: null,
        },
      ],
      { certificateName: 'C', organizationName: 'O' },
      [{ questionId: 'q1', filePath: dummyPath2 }],
    );

    expect(result['q1'].response).toBe('DOC');
    expect(result['q1'].is_flagged).toBe(false);

    try {
      require('fs').unlinkSync(dummyPath2);
    } catch (e) {}
  });
});
