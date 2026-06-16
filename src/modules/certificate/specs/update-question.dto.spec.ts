import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { AddQuestionsDto } from '../dto/add-questions.dto';
import { BulkAddQuestionsDto } from '../dto/bulk-add-questions.dto';
import { UpdateQuestionDto } from '../dto/update-question.dto';
import { QuestionType } from '../types/certificate.types';

describe('UpdateQuestionDto validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('accepts yes_sub_questions and no_sub_questions in PATCH payload', async () => {
    const payload = {
      question: 'Is exit signage visible?',
      type: QuestionType.BOOLEAN,
      yes_sub_questions: [
        {
          question: 'Which signs are missing?',
          type: QuestionType.TEXT,
          yes_sub_questions: [
            {
              question: 'Attach photo evidence',
              type: QuestionType.FILE,
            },
          ],
          no_sub_questions: [],
        },
      ],
      no_sub_questions: [
        {
          question: 'Is emergency lighting operational?',
          type: QuestionType.BOOLEAN,
        },
      ],
    };

    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: UpdateQuestionDto,
      }),
    ).resolves.toBeDefined();
  });

  it('accepts AI review, boolean scoring, and conditional logic fields', async () => {
    const payload = {
      type: QuestionType.BOOLEAN,
      ai_review_enabled: true,
      ai_review_criteria: 'Confirm evidence supports the selected answer',
      yes_score: 100,
      no_score: 0,
      conditional_logic_enabled: true,
      conditional_logic: {
        yes: {
          redirect_to: {
            target_type: 'section',
            target_id: '550e8400-e29b-41d4-a716-446655440001',
          },
        },
        no: {
          blocked_sections: [
            {
              target_type: 'sub_section',
              target_id: '550e8400-e29b-41d4-a716-446655440002',
            },
          ],
          allowed_sections: [
            {
              target_type: 'question',
              target_id: '550e8400-e29b-41d4-a716-446655440003',
            },
          ],
        },
      },
    };

    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: UpdateQuestionDto,
      }),
    ).resolves.toBeDefined();
  });

  it('accepts conditional logic fields in add question payloads', async () => {
    const payload = {
      section_type: 'section',
      questions: [
        {
          question: 'Do you have a fire safety plan?',
          type: QuestionType.BOOLEAN,
          yes_score: 100,
          no_score: 0,
          conditional_logic_enabled: true,
          conditional_logic: {
            yes: {
              redirect_to: {
                target_type: 'section',
                target_id: '550e8400-e29b-41d4-a716-446655440001',
              },
              allowed_sections: [
                {
                  target_type: 'sub_section',
                  target_id: '550e8400-e29b-41d4-a716-446655440002',
                },
              ],
            },
            no: {
              blocked_sections: [
                {
                  target_type: 'question',
                  target_id: '550e8400-e29b-41d4-a716-446655440003',
                },
              ],
            },
          },
        },
      ],
    };

    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: AddQuestionsDto,
      }),
    ).resolves.toBeDefined();
  });

  it('accepts conditional logic fields in bulk add question payloads', async () => {
    const payload = {
      entries: [
        {
          section_id: '550e8400-e29b-41d4-a716-446655440010',
          section_type: 'sub_section',
          questions: [
            {
              question: 'Is the extinguisher inspected monthly?',
              type: QuestionType.BOOLEAN,
              conditional_logic_enabled: true,
              conditional_logic: {
                yes: {
                  redirect_to: {
                    target_type: 'main_section',
                    target_id: '550e8400-e29b-41d4-a716-446655440011',
                  },
                },
              },
            },
          ],
        },
      ],
    };

    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: BulkAddQuestionsDto,
      }),
    ).resolves.toBeDefined();
  });

  it('still rejects unknown fields with whitelist enabled', async () => {
    const payload = {
      question: 'Sample question',
      unknown_field: 'should fail',
    };

    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: UpdateQuestionDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
