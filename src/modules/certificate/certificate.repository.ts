import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PoolClient } from 'pg';
import {
  Certificate,
  Badge,
  MainSection,
  Section,
  SubSection,
  Question,
  NestedQuestion,
  QuestionConditionalLogic,
} from './types/certificate.types';
import { QueryResult } from '../../common/types/database.types';

type SubSectionWithQuestions = SubSection & { questions: Question[] };

function groupSubQuestions(questions: Question[]): Question[] {
  const yesMap = new Map<string, Question[]>();
  const noMap = new Map<string, Question[]>();
  const topLevel: Question[] = [];

  for (const q of questions) {
    if (q.parent_question_id && q.parent_trigger_value) {
      const map = q.parent_trigger_value === 'yes' ? yesMap : noMap;
      const list = map.get(q.parent_question_id) || [];
      list.push(q);
      map.set(q.parent_question_id, list);
    } else {
      topLevel.push(q);
    }
  }

  const attachChildren = (q: Question): Question => ({
    ...q,
    yes_sub_questions: (yesMap.get(q.id) || []).map(attachChildren),
    no_sub_questions: (noMap.get(q.id) || []).map(attachChildren),
  });

  return topLevel.map(attachChildren);
}
type SectionWithDetails = Section & {
  questions: Question[];
  sub_sections: SubSectionWithQuestions[];
};
type MainSectionWithSections = MainSection & { sections: SectionWithDetails[] };
type CertificateDetails = Certificate & {
  badges: Badge[];
  main_sections: MainSectionWithSections[];
};

@Injectable()
export class CertificateRepository {
  constructor(private readonly db: DatabaseService) {}

  async createCertificate(
    client: PoolClient,
    data: {
      certificate_id: string;
      short_code: string;
      name: string;
      industry_ids: string[];
      disclosure_price: number;
      assured_price?: number;
      validity_days?: number;
      validity_months?: number;
      validity_years?: number;
      compulsory_docs?: string[];
      description?: string;
      is_published?: boolean;
      created_by?: string;
    },
  ): Promise<{ id: string }> {
    const result = (await client.query(
      `INSERT INTO certificates (
        certificate_id, short_code, name, industry_ids, disclosure_price, assured_price,
        validity_days, validity_months, validity_years, compulsory_docs, description, is_published, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
      RETURNING id`,
      [
        data.certificate_id,
        data.short_code,
        data.name,
        data.industry_ids || null,
        data.disclosure_price,
        data.assured_price || null,
        data.validity_days || 0,
        data.validity_months || 0,
        data.validity_years || 0,
        data.compulsory_docs || null,
        data.description || null,
        data.is_published || false,
        data.created_by || null,
      ],
    )) as QueryResult<{ id: string }>;
    return { id: result.rows[0].id };
  }

  async findCertificateById(id: string): Promise<Certificate | null> {
    const result = (await this.db.query(
      `SELECT 
        c.*,
        COALESCE(
          NULLIF(TRIM(COALESCE(cb_emp.first_name, '') || ' ' || COALESCE(cb_emp.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_aud.first_name, '') || ' ' || COALESCE(cb_aud.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_rev.first_name, '') || ' ' || COALESCE(cb_rev.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_sub.first_name, '') || ' ' || COALESCE(cb_sub.last_name, '')), '')
        ) as created_by_name,
        COALESCE(
          NULLIF(TRIM(COALESCE(ub_emp.first_name, '') || ' ' || COALESCE(ub_emp.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_aud.first_name, '') || ' ' || COALESCE(ub_aud.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_rev.first_name, '') || ' ' || COALESCE(ub_rev.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_sub.first_name, '') || ' ' || COALESCE(ub_sub.last_name, '')), ''),
          ub_user.email
        ) as updated_by_name
      FROM certificates c
      LEFT JOIN users cb_user ON c.created_by = cb_user.id
      LEFT JOIN employee cb_emp ON cb_user.id = cb_emp.user_id
      LEFT JOIN auditor cb_aud ON cb_user.id = cb_aud.user_id
      LEFT JOIN reviewer cb_rev ON cb_user.id = cb_rev.user_id
      LEFT JOIN subadmin cb_sub ON cb_user.id = cb_sub.user_id
      LEFT JOIN users ub_user ON c.updated_by = ub_user.id
      LEFT JOIN employee ub_emp ON ub_user.id = ub_emp.user_id
      LEFT JOIN auditor ub_aud ON ub_user.id = ub_aud.user_id
      LEFT JOIN reviewer ub_rev ON ub_user.id = ub_rev.user_id
      LEFT JOIN subadmin ub_sub ON ub_user.id = ub_sub.user_id
      WHERE c.id = $1`,
      [id],
    )) as QueryResult<
      Certificate & { created_by_name?: string; updated_by_name?: string }
    >;
    return result.rows[0] || null;
  }

  async findCertificateByCertificateId(
    certificateId: string,
  ): Promise<Certificate | null> {
    const result = (await this.db.query(
      `SELECT * FROM certificates WHERE certificate_id = $1 LIMIT 1`,
      [certificateId],
    )) as QueryResult<Certificate>;
    return result.rows[0] || null;
  }

  async findMaxVersionByCertificateIdBase(
    baseId: string,
  ): Promise<number> {
    const result = (await this.db.query(
      `SELECT certificate_id FROM certificates WHERE certificate_id LIKE $1 ORDER BY certificate_id DESC LIMIT 1`,
      [`${baseId}-v%`],
    )) as QueryResult<{ certificate_id: string }>;
    if (result.rows.length === 0) return 1;
    const match = result.rows[0].certificate_id.match(/-v(\d+)$/i);
    return match ? parseInt(match[1], 10) : 1;
  }

  async createBadge(
    client: PoolClient,
    data: {
      certificate_id: string;
      slot: number;
      name: string;
    },
  ): Promise<{ id: string }> {
    const result = (await client.query(
      `INSERT INTO badges (certificate_id, slot, name) VALUES ($1, $2, $3) RETURNING id`,
      [data.certificate_id, data.slot, data.name],
    )) as QueryResult<{ id: string }>;
    return { id: result.rows[0].id };
  }

  async createBadgeColors(
    client: PoolClient,
    badgeId: string,
    colors: Array<{ color: string; min_score: number; max_score: number }>,
  ): Promise<void> {
    if (colors.length === 0) return;

    const valuePlaceholders: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const colorData of colors) {
      valuePlaceholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      values.push(badgeId, colorData.color, colorData.min_score, colorData.max_score);
    }

    await client.query(
      `INSERT INTO badge_colors (badge_id, color, min_score, max_score) VALUES ${valuePlaceholders.join(', ')}`,
      values,
    );
  }

  async getMaxMainSectionRank(
    client: PoolClient,
    certificateId: string,
  ): Promise<number> {
    const result = (await client.query(
      `SELECT COALESCE(MAX(rank), 0) as max_rank 
       FROM main_section 
       WHERE certificate_id = $1`,
      [certificateId],
    )) as QueryResult<{ max_rank: number }>;
    return result.rows[0].max_rank;
  }

  async createMainSection(
    client: PoolClient,
    data: {
      certificate_id: string;
      name: string;
      short_code?: string | null;
      rank: number;
    },
  ): Promise<{ id: string; name: string; short_code?: string | null; rank: number }> {
    const result = (await client.query(
      `INSERT INTO main_section (certificate_id, name, short_code, rank) VALUES ($1, $2, $3, $4) 
       RETURNING id, name, short_code, rank`,
      [data.certificate_id, data.name, data.short_code || null, data.rank],
    )) as QueryResult<{ id: string; name: string; short_code?: string | null; rank: number }>;
    return result.rows[0];
  }

  async findMainSectionById(id: string, client?: PoolClient): Promise<MainSection | null> {
    const result = (await this.queryWith(client).query(
      `SELECT * FROM main_section WHERE id = $1`,
      [id],
    )) as QueryResult<MainSection>;
    return result.rows[0] || null;
  }

  async getMaxSectionRank(client: PoolClient, mainId: string): Promise<number> {
    const result = (await client.query(
      `SELECT COALESCE(MAX(rank), 0) as max_rank 
       FROM sections 
       WHERE main_id = $1`,
      [mainId],
    )) as QueryResult<{ max_rank: number }>;
    return result.rows[0].max_rank;
  }

  async createSection(
    client: PoolClient,
    data: {
      certificate_id: string;
      main_id: string;
      name: string;
      short_code?: string | null;
      rank: number;
    },
  ): Promise<{ id: string; name: string; short_code?: string | null; rank: number }> {
    const result = (await client.query(
      `INSERT INTO sections (certificate_id, main_id, name, short_code, rank) VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, short_code, rank`,
      [data.certificate_id, data.main_id, data.name, data.short_code || null, data.rank],
    )) as QueryResult<{ id: string; name: string; short_code?: string | null; rank: number }>;
    return result.rows[0];
  }

  async findSectionById(id: string, client?: PoolClient): Promise<Section | null> {
    const result = (await this.queryWith(client).query(
      `SELECT * FROM sections WHERE id = $1`,
      [id],
    )) as QueryResult<Section>;
    return result.rows[0] || null;
  }

  async getMaxSubSectionRank(
    client: PoolClient,
    sectionId: string,
  ): Promise<number> {
    const result = (await client.query(
      `SELECT COALESCE(MAX(rank), 0) as max_rank 
       FROM sub_section 
       WHERE section_id = $1`,
      [sectionId],
    )) as QueryResult<{ max_rank: number }>;
    return result.rows[0].max_rank;
  }

  async createSubSection(
    client: PoolClient,
    data: {
      certificate_id: string;
      main_id: string;
      section_id: string;
      name: string;
      short_code?: string | null;
      rank: number;
    },
  ): Promise<{ id: string; name: string; short_code?: string | null; rank: number }> {
    const result = (await client.query(
      `INSERT INTO sub_section (certificate_id, main_id, section_id, name, short_code, rank) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, name, short_code, rank`,
      [
        data.certificate_id,
        data.main_id,
        data.section_id,
        data.name,
        data.short_code || null,
        data.rank,
      ],
    )) as QueryResult<{ id: string; name: string; short_code?: string | null; rank: number }>;
    return result.rows[0];
  }

  async findSubSectionById(id: string, client?: PoolClient): Promise<SubSection | null> {
    const result = (await this.queryWith(client).query(
      `SELECT * FROM sub_section WHERE id = $1`,
      [id],
    )) as QueryResult<SubSection>;
    return result.rows[0] || null;
  }

  async getMaxQuestionRankForSection(
    client: PoolClient,
    sectionId: string,
  ): Promise<number> {
    const result = (await client.query(
      `SELECT COALESCE(MAX(rank), 0) as max_rank 
       FROM questions 
       WHERE section_id = $1 AND is_third_level = FALSE`,
      [sectionId],
    )) as QueryResult<{ max_rank: number }>;
    return result.rows[0].max_rank;
  }

  async getMaxQuestionRankForSubSection(
    client: PoolClient,
    subSectionId: string,
  ): Promise<number> {
    const result = (await client.query(
      `SELECT COALESCE(MAX(rank), 0) as max_rank 
       FROM questions 
       WHERE sub_section_id = $1 AND is_third_level = TRUE`,
      [subSectionId],
    )) as QueryResult<{ max_rank: number }>;
    return result.rows[0].max_rank;
  }

  async getMaxQuestionNumberForSection(
    client: PoolClient,
    sectionId: string,
  ): Promise<number> {
    const result = (await client.query(
      `SELECT COALESCE(MAX(question_number), 0) as max_number 
       FROM questions 
       WHERE section_id = $1 AND is_third_level = FALSE`,
      [sectionId],
    )) as QueryResult<{ max_number: number }>;
    return result.rows[0].max_number;
  }

  async getMaxQuestionNumberForSubSection(
    client: PoolClient,
    subSectionId: string,
  ): Promise<number> {
    const result = (await client.query(
      `SELECT COALESCE(MAX(question_number), 0) as max_number 
       FROM questions 
       WHERE sub_section_id = $1 AND is_third_level = TRUE`,
      [subSectionId],
    )) as QueryResult<{ max_number: number }>;
    return result.rows[0].max_number;
  }

  async shiftQuestionNumbersForSectionInsert(
    client: PoolClient,
    sectionId: string,
    fromNumber: number,
  ): Promise<void> {
    await client.query(
      `UPDATE questions SET question_number = question_number + 1
       WHERE section_id = $1 AND is_third_level = FALSE AND question_number >= $2`,
      [sectionId, fromNumber],
    );
  }

  async shiftQuestionNumbersForSubSectionInsert(
    client: PoolClient,
    subSectionId: string,
    fromNumber: number,
  ): Promise<void> {
    await client.query(
      `UPDATE questions SET question_number = question_number + 1
       WHERE sub_section_id = $1 AND is_third_level = TRUE AND question_number >= $2`,
      [subSectionId, fromNumber],
    );
  }

  async shiftQuestionNumbersForSectionDelete(
    client: PoolClient,
    sectionId: string,
    fromNumber: number,
  ): Promise<void> {
    await client.query(
      `UPDATE questions SET question_number = question_number - 1
       WHERE section_id = $1 AND is_third_level = FALSE AND question_number > $2`,
      [sectionId, fromNumber],
    );
  }

  async shiftQuestionNumbersForSubSectionDelete(
    client: PoolClient,
    subSectionId: string,
    fromNumber: number,
  ): Promise<void> {
    await client.query(
      `UPDATE questions SET question_number = question_number - 1
       WHERE sub_section_id = $1 AND is_third_level = TRUE AND question_number > $2`,
      [subSectionId, fromNumber],
    );
  }

  async findQuestionBySectionNumber(
    sectionId: string,
    questionNumber: number,
  ): Promise<Question | null> {
    const result = (await this.db.query(
      `SELECT 
        q.*, 
        s.name as section_name,
        ss.name as sub_section_name
       FROM questions q
       LEFT JOIN sections s ON q.section_id = s.id
       LEFT JOIN sub_section ss ON q.sub_section_id = ss.id
       WHERE q.section_id = $1 AND q.question_number = $2 AND q.is_third_level = FALSE LIMIT 1`,
      [sectionId, questionNumber],
    )) as QueryResult<Question>;
    return result.rows[0] || null;
  }

  async findQuestionBySubSectionNumber(
    subSectionId: string,
    questionNumber: number,
  ): Promise<Question | null> {
    const result = (await this.db.query(
      `SELECT 
        q.*, 
        s.name as section_name,
        ss.name as sub_section_name
       FROM questions q
       LEFT JOIN sections s ON q.section_id = s.id
       LEFT JOIN sub_section ss ON q.sub_section_id = ss.id
       WHERE q.sub_section_id = $1 AND q.question_number = $2 AND q.is_third_level = TRUE LIMIT 1`,
      [subSectionId, questionNumber],
    )) as QueryResult<Question>;
    return result.rows[0] || null;
  }

  async findSectionByRank(
    mainSectionId: string,
    rank: number,
  ): Promise<Section | null> {
    const result = (await this.db.query(
      `SELECT * FROM sections WHERE main_id = $1 AND rank = $2 LIMIT 1`,
      [mainSectionId, rank],
    )) as QueryResult<Section>;
    return result.rows[0] || null;
  }

  async findSubSectionByRank(
    sectionId: string,
    rank: number,
  ): Promise<SubSection | null> {
    const result = (await this.db.query(
      `SELECT * FROM sub_section WHERE section_id = $1 AND rank = $2 LIMIT 1`,
      [sectionId, rank],
    )) as QueryResult<SubSection>;
    return result.rows[0] || null;
  }

  async findMainSectionByRank(
    certificateId: string,
    rank: number,
  ): Promise<MainSection | null> {
    const result = (await this.db.query(
      `SELECT * FROM main_section WHERE certificate_id = $1 AND rank = $2 LIMIT 1`,
      [certificateId, rank],
    )) as QueryResult<MainSection>;
    return result.rows[0] || null;
  }

  async findMainSectionByName(
    certificateId: string,
    name: string,
  ): Promise<MainSection | null> {
    const result = (await this.db.query(
      `SELECT * FROM main_section WHERE certificate_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [certificateId, name],
    )) as QueryResult<MainSection>;
    return result.rows[0] || null;
  }

  async findSectionByName(
    mainSectionId: string,
    name: string,
  ): Promise<Section | null> {
    const result = (await this.db.query(
      `SELECT * FROM sections WHERE main_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [mainSectionId, name],
    )) as QueryResult<Section>;
    return result.rows[0] || null;
  }

  async findSectionByNameInCertificate(
    certificateId: string,
    name: string,
  ): Promise<Section | null> {
    const result = (await this.db.query(
      `SELECT * FROM sections WHERE certificate_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [certificateId, name],
    )) as QueryResult<Section>;
    return result.rows[0] || null;
  }

  async findSubSectionByName(
    sectionId: string,
    name: string,
  ): Promise<SubSection | null> {
    const result = (await this.db.query(
      `SELECT * FROM sub_section WHERE section_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [sectionId, name],
    )) as QueryResult<SubSection>;
    return result.rows[0] || null;
  }

  async findSubSectionByNameInCertificate(
    certificateId: string,
    name: string,
  ): Promise<SubSection | null> {
    const result = (await this.db.query(
      `SELECT * FROM sub_section WHERE certificate_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [certificateId, name],
    )) as QueryResult<SubSection>;
    return result.rows[0] || null;
  }

  async getMainSectionChildren(
    mainSectionId: string,
  ): Promise<(Section & { questions_count: number })[]> {
    const result = (await this.db.query(
      `SELECT s.*, COUNT(q.id) as questions_count
       FROM sections s
       LEFT JOIN questions q ON q.section_id = s.id AND q.is_third_level = FALSE
       WHERE s.main_id = $1
       GROUP BY s.id
       ORDER BY s.rank ASC`,
      [mainSectionId],
    )) as QueryResult<Section & { questions_count: string }>;
    return result.rows.map((row) => ({
      ...row,
      questions_count: parseInt(row.questions_count as any, 10),
    }));
  }

  async getSectionChildren(
    sectionId: string,
  ): Promise<(SubSection & { questions_count: number })[]> {
    const result = (await this.db.query(
      `SELECT ss.*, COUNT(q.id) as questions_count
       FROM sub_section ss
       LEFT JOIN questions q ON q.sub_section_id = ss.id AND q.is_third_level = TRUE
       WHERE ss.section_id = $1
       GROUP BY ss.id
       ORDER BY ss.rank ASC`,
      [sectionId],
    )) as QueryResult<SubSection & { questions_count: string }>;
    return result.rows.map((row) => ({
      ...row,
      questions_count: parseInt(row.questions_count as any, 10),
    }));
  }

  async getSubSectionQuestions(subSectionId: string): Promise<Question[]> {
    const result = (await this.db.query(
      `SELECT *, parent_question_id, parent_trigger_value FROM questions
       WHERE sub_section_id = $1 AND is_third_level = TRUE
       ORDER BY rank ASC`,
      [subSectionId],
    )) as QueryResult<Question>;
    return result.rows;
  }

  async getSectionQuestions(sectionId: string): Promise<Question[]> {
    const result = (await this.db.query(
      `SELECT *, parent_question_id, parent_trigger_value FROM questions
       WHERE section_id = $1 AND is_third_level = FALSE
       ORDER BY rank ASC`,
      [sectionId],
    )) as QueryResult<Question>;
    return result.rows;
  }

  async getQuestionChildrenByTrigger(
    parentQuestionId: string,
    triggerValue: 'yes' | 'no',
    client?: PoolClient,
  ): Promise<Question[]> {
    const result = (await this.queryWith(client).query(
      `SELECT * FROM questions
       WHERE parent_question_id = $1 AND parent_trigger_value = $2
       ORDER BY rank ASC`,
      [parentQuestionId, triggerValue],
    )) as QueryResult<Question>;
    return result.rows;
  }

  async getSectionFullTree(sectionId: string): Promise<{
    questions: Question[];
    sub_sections: SubSectionWithQuestions[];
  }> {
    const [questionsResult, subSectionsResult, subSectionQuestionsResult] =
      await Promise.all([
        this.db.query(
          `SELECT * FROM questions WHERE section_id = $1 AND is_third_level = FALSE ORDER BY rank ASC`,
          [sectionId],
        ) as Promise<QueryResult<Question>>,
        this.db.query(
          `SELECT ss.*, COUNT(q.id) as questions_count
           FROM sub_section ss
           LEFT JOIN questions q ON q.sub_section_id = ss.id AND q.is_third_level = TRUE
           WHERE ss.section_id = $1
           GROUP BY ss.id
           ORDER BY ss.rank ASC`,
          [sectionId],
        ) as Promise<QueryResult<SubSection & { questions_count: string }>>,
        this.db.query(
          `SELECT * FROM questions WHERE sub_section_id IN (SELECT id FROM sub_section WHERE section_id = $1) AND is_third_level = TRUE ORDER BY rank ASC`,
          [sectionId],
        ) as Promise<QueryResult<Question>>,
      ]);

    const questionsBySubSection = new Map<string, Question[]>();
    for (const q of subSectionQuestionsResult.rows) {
      const list = questionsBySubSection.get(q.sub_section_id!) || [];
      list.push(q);
      questionsBySubSection.set(q.sub_section_id!, list);
    }

    return {
      questions: groupSubQuestions(questionsResult.rows),
      sub_sections: subSectionsResult.rows.map((ss) => ({
        ...ss,
        questions_count: parseInt(ss.questions_count as any, 10),
        questions: groupSubQuestions(questionsBySubSection.get(ss.id) || []),
      })),
    };
  }

  async getMainSectionFullTree(mainSectionId: string): Promise<
    (Section & {
      questions: Question[];
      sub_sections: SubSectionWithQuestions[];
    })[]
  > {
    const [sectionsResult, directQuestionsResult, subSectionsResult, subSectionQuestionsResult] =
      await Promise.all([
        this.db.query(
          `SELECT s.*, COUNT(q.id) as questions_count
           FROM sections s
           LEFT JOIN questions q ON q.section_id = s.id AND q.is_third_level = FALSE
           WHERE s.main_id = $1
           GROUP BY s.id
           ORDER BY s.rank ASC`,
          [mainSectionId],
        ) as Promise<QueryResult<Section & { questions_count: string }>>,
        this.db.query(
          `SELECT * FROM questions WHERE section_id IN (SELECT id FROM sections WHERE main_id = $1) AND is_third_level = FALSE ORDER BY rank ASC`,
          [mainSectionId],
        ) as Promise<QueryResult<Question>>,
        this.db.query(
          `SELECT ss.*, COUNT(q.id) as questions_count
           FROM sub_section ss
           LEFT JOIN questions q ON q.sub_section_id = ss.id AND q.is_third_level = TRUE
           WHERE ss.main_id = $1
           GROUP BY ss.id
           ORDER BY ss.rank ASC`,
          [mainSectionId],
        ) as Promise<QueryResult<SubSection & { questions_count: string }>>,
        this.db.query(
          `SELECT * FROM questions WHERE sub_section_id IN (SELECT id FROM sub_section WHERE main_id = $1) AND is_third_level = TRUE ORDER BY rank ASC`,
          [mainSectionId],
        ) as Promise<QueryResult<Question>>,
      ]);

    const questionsBySection = new Map<string, Question[]>();
    for (const q of directQuestionsResult.rows) {
      const list = questionsBySection.get(q.section_id) || [];
      list.push(q);
      questionsBySection.set(q.section_id, list);
    }

    const subSectionsBySection = new Map<string, (SubSection & { questions_count: number })[]>();
    for (const ss of subSectionsResult.rows) {
      const list = subSectionsBySection.get(ss.section_id) || [];
      list.push({ ...ss, questions_count: parseInt(ss.questions_count as any, 10) });
      subSectionsBySection.set(ss.section_id, list);
    }

    const questionsBySubSection = new Map<string, Question[]>();
    for (const q of subSectionQuestionsResult.rows) {
      const list = questionsBySubSection.get(q.sub_section_id!) || [];
      list.push(q);
      questionsBySubSection.set(q.sub_section_id!, list);
    }

    return sectionsResult.rows.map((s) => ({
      ...s,
      questions_count: parseInt(s.questions_count as any, 10),
      questions: groupSubQuestions(questionsBySection.get(s.id) || []),
      sub_sections: (subSectionsBySection.get(s.id) || []).map((ss) => ({
        ...ss,
        questions: groupSubQuestions(questionsBySubSection.get(ss.id) || []),
      })),
    }));
  }

  async findQuestionById(id: string, client?: PoolClient): Promise<Question | null> {
    const result = (await this.queryWith(client).query(
      `SELECT 
        q.*, 
        s.name as section_name,
        ss.name as sub_section_name
       FROM questions q
       LEFT JOIN sections s ON q.section_id = s.id
       LEFT JOIN sub_section ss ON q.sub_section_id = ss.id
       WHERE q.id = $1`,
      [id],
    )) as QueryResult<Question>;
    return result.rows[0] || null;
  }

  async countQuestionsInSection(sectionId: string): Promise<number> {
    const result = (await this.db.query(
      `SELECT COUNT(*) as total FROM questions WHERE section_id = $1 AND is_third_level = FALSE`,
      [sectionId],
    )) as QueryResult<{ total: string }>;
    return parseInt(result.rows[0].total, 10);
  }

  async countQuestionsInSubSection(subSectionId: string): Promise<number> {
    const result = (await this.db.query(
      `SELECT COUNT(*) as total FROM questions WHERE sub_section_id = $1 AND is_third_level = TRUE`,
      [subSectionId],
    )) as QueryResult<{ total: string }>;
    return parseInt(result.rows[0].total, 10);
  }

  async getMaxCertificateQuestionNumber(
    client: PoolClient,
    certificateId: string,
  ): Promise<number> {
    const result = (await client.query(
      `SELECT COALESCE(MAX(certificate_question_number), 0) as max_number 
       FROM questions WHERE certificate_id = $1`,
      [certificateId],
    )) as QueryResult<{ max_number: number }>;
    return result.rows[0].max_number;
  }

  async findQuestionByCertificateNumber(
    certificateId: string,
    certificateQuestionNumber: number,
  ): Promise<Question | null> {
    const result = (await this.db.query(
      `SELECT 
        q.*, 
        s.name as section_name,
        ss.name as sub_section_name
       FROM questions q
       LEFT JOIN sections s ON q.section_id = s.id
       LEFT JOIN sub_section ss ON q.sub_section_id = ss.id
       WHERE q.certificate_id = $1 AND q.certificate_question_number = $2 LIMIT 1`,
      [certificateId, certificateQuestionNumber],
    )) as QueryResult<Question>;
    return result.rows[0] || null;
  }

  async shiftCertificateQuestionNumbersForInsert(
    client: PoolClient,
    certificateId: string,
    fromNumber: number,
  ): Promise<void> {
    await client.query(
      `UPDATE questions SET certificate_question_number = certificate_question_number + 1
       WHERE certificate_id = $1 AND certificate_question_number >= $2`,
      [certificateId, fromNumber],
    );
  }

  async shiftCertificateQuestionNumbersForDelete(
    client: PoolClient,
    certificateId: string,
    fromNumber: number,
  ): Promise<void> {
    await client.query(
      `UPDATE questions SET certificate_question_number = certificate_question_number - 1
       WHERE certificate_id = $1 AND certificate_question_number > $2`,
      [certificateId, fromNumber],
    );
  }

  async countQuestionsInCertificate(certificateId: string): Promise<number> {
    const result = (await this.db.query(
      `SELECT COUNT(*) as total FROM questions WHERE certificate_id = $1`,
      [certificateId],
    )) as QueryResult<{ total: string }>;
    return parseInt(result.rows[0].total, 10);
  }

  // Create a question for a section
  async createQuestionForSection(
    client: PoolClient,
    data: {
      certificate_id: string;
      main_section_id: string;
      section_id: string;
      question: string;
      short_code?: string | null;
      type: string;
      rank: number;
      question_number?: number;
      certificate_question_number?: number;
      hint?: string;
      criteria?: string;
      ai_review_enabled?: boolean;
      ai_review_criteria?: string | null;
      ai_review_score?: number | null;
      yes_score?: number | null;
      no_score?: number | null;
      conditional_logic_enabled?: boolean;
      conditional_logic?: QuestionConditionalLogic | null;
      score?: number;
      is_compulsory?: boolean;
      options?: string[];
      parent_question_id?: string | null;
      parent_trigger_value?: 'yes' | 'no' | null;
    },
  ): Promise<{
    id: string;
    question: string;
    short_code?: string | null;
    rank: number;
    question_number?: number;
    certificate_question_number?: number;
    criteria?: string;
    score: number;
  }> {
    const result = (await client.query(
      `INSERT INTO questions (
        certificate_id, main_section_id, section_id, sub_section_id,
        question, short_code, hint, type, is_third_level, criteria,
        ai_review_enabled, ai_review_criteria, ai_review_score, yes_score, no_score,
        conditional_logic_enabled, conditional_logic,
        rank, question_number, certificate_question_number, score, options,
        parent_question_id, parent_trigger_value, is_compulsory
      ) VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, FALSE, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18, $19, $20::jsonb, $21, $22, $23)
      RETURNING id, question, short_code, rank, question_number, certificate_question_number, criteria, score`,
      [
        data.certificate_id,
        data.main_section_id,
        data.section_id,
        data.question,
        data.short_code || null,
        data.hint || null,
        data.type,
        data.criteria || null,
        data.ai_review_enabled ?? false,
        data.ai_review_criteria || null,
        data.ai_review_score ?? null,
        data.yes_score ?? null,
        data.no_score ?? null,
        data.conditional_logic_enabled ?? false,
        data.conditional_logic ? JSON.stringify(data.conditional_logic) : null,
        data.rank,
        data.question_number || null,
        data.certificate_question_number || null,
        data.score ?? 0,
        data.options ? JSON.stringify(data.options) : null,
        data.parent_question_id || null,
        data.parent_trigger_value || null,
        data.is_compulsory ?? false,
      ],
    )) as QueryResult<{
      id: string;
      question: string;
      short_code?: string | null;
      rank: number;
      question_number?: number;
      certificate_question_number?: number;
      criteria?: string;
      score: number;
    }>;
    return result.rows[0];
  }

  // Create a question for a subsection
  async createQuestionForSubSection(
    client: PoolClient,
    data: {
      certificate_id: string;
      main_section_id: string;
      section_id: string;
      sub_section_id: string;
      question: string;
      short_code?: string | null;
      type: string;
      rank: number;
      question_number?: number;
      certificate_question_number?: number;
      hint?: string;
      criteria?: string;
      ai_review_enabled?: boolean;
      ai_review_criteria?: string | null;
      ai_review_score?: number | null;
      yes_score?: number | null;
      no_score?: number | null;
      conditional_logic_enabled?: boolean;
      conditional_logic?: QuestionConditionalLogic | null;
      score?: number;
      is_compulsory?: boolean;
      options?: string[];
      parent_question_id?: string | null;
      parent_trigger_value?: 'yes' | 'no' | null;
    },
  ): Promise<{
    id: string;
    question: string;
    short_code?: string | null;
    rank: number;
    question_number?: number;
    certificate_question_number?: number;
    criteria?: string;
    score: number;
  }> {
    const result = (await client.query(
      `INSERT INTO questions (
        certificate_id, main_section_id, section_id, sub_section_id,
        question, short_code, hint, type, is_third_level, criteria,
        ai_review_enabled, ai_review_criteria, ai_review_score, yes_score, no_score,
        conditional_logic_enabled, conditional_logic,
        rank, question_number, certificate_question_number, score, options,
        parent_question_id, parent_trigger_value, is_compulsory
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20, $21::jsonb, $22, $23, $24)
      RETURNING id, question, short_code, rank, question_number, certificate_question_number, criteria, score`,
      [
        data.certificate_id,
        data.main_section_id,
        data.section_id,
        data.sub_section_id,
        data.question,
        data.short_code || null,
        data.hint || null,
        data.type,
        data.criteria || null,
        data.ai_review_enabled ?? false,
        data.ai_review_criteria || null,
        data.ai_review_score ?? null,
        data.yes_score ?? null,
        data.no_score ?? null,
        data.conditional_logic_enabled ?? false,
        data.conditional_logic ? JSON.stringify(data.conditional_logic) : null,
        data.rank,
        data.question_number || null,
        data.certificate_question_number || null,
        data.score ?? 0,
        data.options ? JSON.stringify(data.options) : null,
        data.parent_question_id || null,
        data.parent_trigger_value || null,
        data.is_compulsory ?? false,
      ],
    )) as QueryResult<{
      id: string;
      question: string;
      short_code?: string | null;
      rank: number;
      question_number?: number;
      certificate_question_number?: number;
      criteria?: string;
      score: number;
    }>;
    return result.rows[0];
  }

  async updateCertificate(
    client: PoolClient,
    id: string,
    data: {
      certificate_id?: string;
      short_code?: string;
      name?: string;
      industry_ids?: string[];
      disclosure_price?: number;
      assured_price?: number;
      validity_days?: number;
      validity_months?: number;
      validity_years?: number;
      compulsory_docs?: string[];
      description?: string;
      is_published?: boolean;
      updated_by?: string;
    },
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.certificate_id !== undefined) {
      updates.push(`certificate_id = $${paramIndex++}`);
      values.push(data.certificate_id);
    }
    if (data.short_code !== undefined) {
      updates.push(`short_code = $${paramIndex++}`);
      values.push(data.short_code);
    }
    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.industry_ids !== undefined) {
      updates.push(`industry_ids = $${paramIndex++}`);
      values.push(data.industry_ids || null);
    }
    if (data.disclosure_price !== undefined) {
      updates.push(`disclosure_price = $${paramIndex++}`);
      values.push(data.disclosure_price);
    }
    if (data.assured_price !== undefined) {
      updates.push(`assured_price = $${paramIndex++}`);
      values.push(data.assured_price || null);
    }
    if (data.validity_days !== undefined) {
      updates.push(`validity_days = $${paramIndex++}`);
      values.push(data.validity_days);
    }
    if (data.validity_months !== undefined) {
      updates.push(`validity_months = $${paramIndex++}`);
      values.push(data.validity_months);
    }
    if (data.validity_years !== undefined) {
      updates.push(`validity_years = $${paramIndex++}`);
      values.push(data.validity_years);
    }
    if (data.compulsory_docs !== undefined) {
      updates.push(`compulsory_docs = $${paramIndex++}`);
      values.push(data.compulsory_docs || null);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description || null);
    }
    if (data.is_published !== undefined) {
      updates.push(`is_published = $${paramIndex++}`);
      values.push(data.is_published);
    }
    if (data.updated_by !== undefined) {
      updates.push(`updated_by = $${paramIndex++}`);
      values.push(data.updated_by || null);
    }

    if (updates.length === 0) {
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await client.query(
      `UPDATE certificates SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values,
    );
  }

  async updateMainSection(
    id: string,
    data: { name?: string; rank?: number },
  ): Promise<MainSection | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.rank !== undefined) {
      updates.push(`rank = $${paramIndex++}`);
      values.push(data.rank);
    }

    if (updates.length === 0) {
      return this.findMainSectionById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = (await this.db.query(
      `UPDATE main_section SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    )) as QueryResult<MainSection>;
    return result.rows[0] || null;
  }

  async updateSection(
    id: string,
    data: { name?: string; rank?: number },
  ): Promise<Section | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.rank !== undefined) {
      updates.push(`rank = $${paramIndex++}`);
      values.push(data.rank);
    }

    if (updates.length === 0) {
      return this.findSectionById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = (await this.db.query(
      `UPDATE sections SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    )) as QueryResult<Section>;
    return result.rows[0] || null;
  }

  async updateSubSection(
    id: string,
    data: { name?: string; rank?: number },
  ): Promise<SubSection | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.rank !== undefined) {
      updates.push(`rank = $${paramIndex++}`);
      values.push(data.rank);
    }

    if (updates.length === 0) {
      return this.findSubSectionById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = (await this.db.query(
      `UPDATE sub_section SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    )) as QueryResult<SubSection>;
    return result.rows[0] || null;
  }

  async updateQuestion(
    id: string,
    data: {
      question?: string;
      hint?: string;
      type?: string;
      criteria?: string;
      ai_review_enabled?: boolean;
      ai_review_criteria?: string | null;
      ai_review_score?: number | null;
      yes_score?: number | null;
      no_score?: number | null;
      conditional_logic_enabled?: boolean;
      conditional_logic?: QuestionConditionalLogic | null;
      rank?: number;
      question_number?: number;
      certificate_question_number?: number;
      score?: number;
      is_compulsory?: boolean;
      options?: string[];
    },
    client?: PoolClient,
  ): Promise<Question | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.question !== undefined) {
      updates.push(`question = $${paramIndex++}`);
      values.push(data.question);
    }
    if (data.hint !== undefined) {
      updates.push(`hint = $${paramIndex++}`);
      values.push(data.hint || null);
    }
    if (data.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(data.type);
    }
    if (data.criteria !== undefined) {
      updates.push(`criteria = $${paramIndex++}`);
      values.push(data.criteria || null);
    }
    if (data.ai_review_enabled !== undefined) {
      updates.push(`ai_review_enabled = $${paramIndex++}`);
      values.push(data.ai_review_enabled);
    }
    if (data.ai_review_criteria !== undefined) {
      updates.push(`ai_review_criteria = $${paramIndex++}`);
      values.push(data.ai_review_criteria || null);
    }
    if (data.ai_review_score !== undefined) {
      updates.push(`ai_review_score = $${paramIndex++}`);
      values.push(data.ai_review_score);
    }
    if (data.yes_score !== undefined) {
      updates.push(`yes_score = $${paramIndex++}`);
      values.push(data.yes_score);
    }
    if (data.no_score !== undefined) {
      updates.push(`no_score = $${paramIndex++}`);
      values.push(data.no_score);
    }
    if (data.conditional_logic_enabled !== undefined) {
      updates.push(`conditional_logic_enabled = $${paramIndex++}`);
      values.push(data.conditional_logic_enabled);
    }
    if (data.conditional_logic !== undefined) {
      updates.push(`conditional_logic = $${paramIndex++}::jsonb`);
      values.push(data.conditional_logic ? JSON.stringify(data.conditional_logic) : null);
    }
    if (data.rank !== undefined) {
      updates.push(`rank = $${paramIndex++}`);
      values.push(data.rank);
    }
    if (data.question_number !== undefined) {
      updates.push(`question_number = $${paramIndex++}`);
      values.push(data.question_number);
    }
    if (data.certificate_question_number !== undefined) {
      updates.push(`certificate_question_number = $${paramIndex++}`);
      values.push(data.certificate_question_number);
    }
    if (data.score !== undefined) {
      updates.push(`score = $${paramIndex++}`);
      values.push(data.score);
    }
    if (data.is_compulsory !== undefined) {
      updates.push(`is_compulsory = $${paramIndex++}`);
      values.push(data.is_compulsory);
    }
    if (data.options !== undefined) {
      updates.push(`options = $${paramIndex++}::jsonb`);
      values.push(data.options ? JSON.stringify(data.options) : null);
    }

    if (updates.length === 0) {
      return this.findQuestionById(id, client);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = (await this.queryWith(client).query(
      `UPDATE questions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    )) as QueryResult<Question>;
    return result.rows[0] || null;
  }

  async findBadgesByCertificateId(
    certificateId: string,
  ): Promise<Array<{ id: string; slot: number; name: string }>> {
    const result = (await this.db.query(
      `SELECT id, slot, name FROM badges WHERE certificate_id = $1 ORDER BY slot`,
      [certificateId],
    )) as QueryResult<{ id: string; slot: number; name: string }>;
    return result.rows;
  }

  async deleteBadgesByCertificateId(
    client: PoolClient,
    certificateId: string,
  ): Promise<void> {
    await client.query(
      `DELETE FROM badge_colors WHERE badge_id IN (SELECT id FROM badges WHERE certificate_id = $1)`,
      [certificateId],
    );
    await client.query(
      `DELETE FROM badges WHERE certificate_id = $1`,
      [certificateId],
    );
  }

  async publishCertificate(id: string): Promise<void> {
    await this.db.query(
      `UPDATE certificates SET is_published = TRUE, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async unpublishCertificate(id: string): Promise<void> {
    await this.db.query(
      `UPDATE certificates SET is_published = FALSE, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async searchCertificates(params: {
    query: string;
    limit: number;
    industryIds?: string[];
  }): Promise<Array<{
    id: string;
    certificate_id: string;
    name: string;
    description: string | null;
    disclosure_price: number;
    assured_price: number | null;
    industry_ids: string[];
    industry_names: string[];
    is_published: boolean;
  }>> {
    const searchTerm = `%${params.query}%`;
    const queryParams: any[] = [searchTerm, searchTerm, params.limit];

    let industryClause = '';
    if (params.industryIds && params.industryIds.length > 0) {
      queryParams.push(params.industryIds);
      industryClause = `AND c.industry_ids && $${queryParams.length}::uuid[]`;
    }

    const result = (await this.db.query(
      `SELECT
         c.id,
         c.certificate_id,
         c.name,
         c.description,
         c.disclosure_price,
         c.assured_price,
         c.industry_ids,
         c.is_published,
         (SELECT array_agg(i.name) FROM industry i WHERE i.id = ANY(c.industry_ids)) as industry_names
       FROM certificates c
       WHERE c.is_published = TRUE
         AND (c.name ILIKE $1 OR c.description ILIKE $2 OR c.certificate_id ILIKE $1)
         ${industryClause}
       ORDER BY
         CASE WHEN LOWER(c.name) LIKE LOWER($1) THEN 0 ELSE 1 END,
         c.name ASC
       LIMIT $3`,
      queryParams,
    )) as QueryResult<any>;
    return result.rows;
  }

  async findCertificates(params: {
    page: number;
    limit: number;
    industryId?: string;
    minPrice?: number;
    maxPrice?: number;
    dateFrom?: string;
    dateTo?: string;
    onlyPublished?: boolean;
    prioritizeIndustryIds?: string[];
  }): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const offset = (params.page - 1) * params.limit;

    const whereConditions: string[] = [];
    const whereParams: (string | number)[] = [];

    if (params.industryId) {
      whereParams.push(params.industryId);
      whereConditions.push(`$${whereParams.length} = ANY(c.industry_ids)`);
    }

    if (params.onlyPublished) {
      whereConditions.push('c.is_published = TRUE');
    }

    if (params.minPrice !== undefined) {
      whereParams.push(params.minPrice);
      whereConditions.push(
        `(c.disclosure_price >= $${whereParams.length} OR c.assured_price >= $${whereParams.length})`,
      );
    }

    if (params.maxPrice !== undefined) {
      whereParams.push(params.maxPrice);
      whereConditions.push(
        `(c.disclosure_price <= $${whereParams.length} OR c.assured_price <= $${whereParams.length})`,
      );
    }

    if (params.dateFrom) {
      whereParams.push(params.dateFrom);
      whereConditions.push(`c.created_at >= $${whereParams.length}::timestamptz`);
    }

    if (params.dateTo) {
      whereParams.push(params.dateTo);
      whereConditions.push(`c.created_at <= ($${whereParams.length}::date + INTERVAL '1 day')`);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    const countResult = (await this.db.query(
      `SELECT COUNT(*) as total FROM certificates c ${whereClause}`,
      whereParams,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0].total, 10);

    const dataParams: Array<string | string[] | number> = [...whereParams];
    let prioritizeIndustryIdsParamIndex: number | null = null;
    if (
      params.prioritizeIndustryIds &&
      params.prioritizeIndustryIds.length > 0
    ) {
      dataParams.push(params.prioritizeIndustryIds);
      prioritizeIndustryIdsParamIndex = dataParams.length;
    }
    dataParams.push(params.limit, offset);
    const limitParamIndex = dataParams.length - 1;
    const offsetParamIndex = dataParams.length;

    const recommendationSelect =
      prioritizeIndustryIdsParamIndex !== null
        ? `
        (c.industry_ids && $${prioritizeIndustryIdsParamIndex}::uuid[]) as is_recommended,
        (
          SELECT COUNT(*)
          FROM unnest(c.industry_ids) AS cert_industry
          WHERE cert_industry = ANY($${prioritizeIndustryIdsParamIndex}::uuid[])
        ) as matching_industries_count,`
        : `
        FALSE as is_recommended,
        0 as matching_industries_count,`;

    const orderClause =
      prioritizeIndustryIdsParamIndex !== null
        ? `ORDER BY
         CASE
           WHEN c.industry_ids && $${prioritizeIndustryIdsParamIndex}::uuid[] THEN 0
           ELSE 1
         END ASC,
         c.created_at DESC`
        : `ORDER BY c.created_at DESC`;

    const result = (await this.db.query(
      `SELECT 
        c.*,
        (SELECT array_agg(i.name) FROM industry i WHERE i.id = ANY(c.industry_ids)) as industry_names,
        (SELECT COUNT(*) FROM badges WHERE certificate_id = c.id) as badges_count,
        (SELECT COUNT(*) FROM main_section WHERE certificate_id = c.id) as sections_count,
        (SELECT COUNT(*) FROM questions WHERE certificate_id = c.id) as questions_count,
        (SELECT COUNT(*)::int FROM certificate_assessments ca WHERE ca.certificate_id = c.id) as total_assessments_done,
        (
          SELECT COUNT(*)::int
          FROM unlocked_certificates uc
          LEFT JOIN certificate_assessments uca ON uc.assessment_id = uca.id
          WHERE uc.certificate_id = c.id
            AND uc.is_active = TRUE
            AND (
              uc.assessment_id IS NULL
              OR COALESCE(uca.is_certificate_blocked, FALSE) = FALSE
            )
        ) as total_people_received,
        cb_user.id as created_by_id,
        cb_user.role as created_by_role,
        COALESCE(
          NULLIF(TRIM(COALESCE(cb_emp.first_name, '') || ' ' || COALESCE(cb_emp.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_aud.first_name, '') || ' ' || COALESCE(cb_aud.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_rev.first_name, '') || ' ' || COALESCE(cb_rev.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_sub.first_name, '') || ' ' || COALESCE(cb_sub.last_name, '')), '')
        ) as created_by_name,
        COALESCE(
          NULLIF(TRIM(COALESCE(ub_emp.first_name, '') || ' ' || COALESCE(ub_emp.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_aud.first_name, '') || ' ' || COALESCE(ub_aud.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_rev.first_name, '') || ' ' || COALESCE(ub_rev.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_sub.first_name, '') || ' ' || COALESCE(ub_sub.last_name, '')), ''),
          ub_user.email
        ) as updated_by_name,
        ${recommendationSelect}
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', b2.id,
              'slot', b2.slot,
              'name', b2.name,
              'colors', (
                SELECT COALESCE(json_agg(json_build_object('id', bc.id, 'color', bc.color, 'min_score', bc.min_score, 'max_score', bc.max_score)) FILTER (WHERE bc.id IS NOT NULL), '[]')
                FROM badge_colors bc
                WHERE bc.badge_id = b2.id
              )
            )
          ) FILTER (WHERE b2.id IS NOT NULL), '[]')
          FROM badges b2
          WHERE b2.certificate_id = c.id
        ) as badges
       FROM certificates c
       LEFT JOIN users cb_user ON c.created_by = cb_user.id
       LEFT JOIN employee cb_emp ON cb_user.id = cb_emp.user_id
       LEFT JOIN auditor cb_aud ON cb_user.id = cb_aud.user_id
       LEFT JOIN reviewer cb_rev ON cb_user.id = cb_rev.user_id
       LEFT JOIN subadmin cb_sub ON cb_user.id = cb_sub.user_id
       LEFT JOIN users ub_user ON c.updated_by = ub_user.id
       LEFT JOIN employee ub_emp ON ub_user.id = ub_emp.user_id
       LEFT JOIN auditor ub_aud ON ub_user.id = ub_aud.user_id
       LEFT JOIN reviewer ub_rev ON ub_user.id = ub_rev.user_id
       LEFT JOIN subadmin ub_sub ON ub_user.id = ub_sub.user_id
       ${whereClause}
       ${orderClause}
       LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
      dataParams,
    )) as QueryResult<
      Certificate & {
        industry_names?: string[];
        badges_count?: number;
        sections_count?: number;
        questions_count?: number;
        total_assessments_done?: number;
        total_people_received?: number;
        is_recommended?: boolean;
        matching_industries_count?: number;
        badges?: any[];
        created_by_id?: string;
        created_by_role?: string;
        created_by_name?: string;
        updated_by_name?: string;
      }
    >;

    return {
      data: result.rows,
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async findCertificatesLite(params: { page: number; limit: number }): Promise<{
    data: Array<{ id: string; name: string; product_id: string }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (params.page - 1) * params.limit;

    const countResult = (await this.db.query(
      `SELECT COUNT(*) as total FROM certificates`,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0].total, 10);

    const result = (await this.db.query(
      `SELECT id, name, certificate_id as product_id
       FROM certificates
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [params.limit, offset],
    )) as QueryResult<{ id: string; name: string; product_id: string }>;

    return {
      data: result.rows,
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async findRecommendedCertificates(params: {
    industryIds: string[];
    page: number;
    limit: number;
  }): Promise<{
    data: Array<{
      id: string;
      certificate_id: string;
      name: string;
      industry_ids: string[];
      industry_names: string[];
      disclosure_price: number;
      assured_price: number | null;
      validity_days: number;
      validity_months: number;
      validity_years: number;
      description: string | null;
      is_published: boolean;
      created_at: string;
      matching_industries_count: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (params.page - 1) * params.limit;

    // Build query to find certificates with overlapping industry IDs
    // Using && (array overlap operator) to find certificates with ANY matching industries
    // This includes certificates with even just 1 matching industry
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM certificates c 
      WHERE c.is_published = true 
        AND c.industry_ids && $1::uuid[]
        AND array_length(c.industry_ids, 1) IS NOT NULL
    `;

    const countResult = (await this.db.query(countQuery, [
      params.industryIds,
    ])) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0].total, 10);

    const dataQuery = `
      SELECT 
        c.id,
        c.certificate_id,
        c.name,
        c.industry_ids,
        (SELECT array_agg(i.name) FROM industry i WHERE i.id = ANY(c.industry_ids)) as industry_names,
        c.disclosure_price,
        c.assured_price,
        c.validity_days,
        c.validity_months,
        c.validity_years,
        c.description,
        c.is_published,
        c.created_at,
        -- Count how many industries match (includes single matches)
        (SELECT COUNT(*) FROM unnest(c.industry_ids) AS cert_industry 
         WHERE cert_industry = ANY($1::uuid[])) as matching_industries_count
      FROM certificates c 
      WHERE c.is_published = true 
        AND c.industry_ids && $1::uuid[]
        AND array_length(c.industry_ids, 1) IS NOT NULL
      ORDER BY matching_industries_count DESC, c.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = (await this.db.query(dataQuery, [
      params.industryIds,
      params.limit,
      offset,
    ])) as QueryResult<{
      id: string;
      certificate_id: string;
      name: string;
      industry_ids: string[];
      industry_names: string[];
      disclosure_price: number;
      assured_price: number | null;
      validity_days: number;
      validity_months: number;
      validity_years: number;
      description: string | null;
      is_published: boolean;
      created_at: string;
      matching_industries_count: number;
    }>;

    return {
      data: result.rows,
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async findCertificateWithDetails(
    id: string,
  ): Promise<CertificateDetails | null> {
    const certResult = (await this.db.query(
      `SELECT 
        c.*, 
        (SELECT array_agg(i.name) FROM industry i WHERE i.id = ANY(c.industry_ids)) as industry_names,
        COALESCE(
          NULLIF(TRIM(COALESCE(cb_emp.first_name, '') || ' ' || COALESCE(cb_emp.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_aud.first_name, '') || ' ' || COALESCE(cb_aud.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_rev.first_name, '') || ' ' || COALESCE(cb_rev.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_sub.first_name, '') || ' ' || COALESCE(cb_sub.last_name, '')), '')
        ) as created_by_name,
        COALESCE(
          NULLIF(TRIM(COALESCE(ub_emp.first_name, '') || ' ' || COALESCE(ub_emp.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_aud.first_name, '') || ' ' || COALESCE(ub_aud.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_rev.first_name, '') || ' ' || COALESCE(ub_rev.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_sub.first_name, '') || ' ' || COALESCE(ub_sub.last_name, '')), ''),
          ub_user.email
        ) as updated_by_name
      FROM certificates c
      LEFT JOIN users cb_user ON c.created_by = cb_user.id
      LEFT JOIN employee cb_emp ON cb_user.id = cb_emp.user_id
      LEFT JOIN auditor cb_aud ON cb_user.id = cb_aud.user_id
      LEFT JOIN reviewer cb_rev ON cb_user.id = cb_rev.user_id
      LEFT JOIN subadmin cb_sub ON cb_user.id = cb_sub.user_id
      LEFT JOIN users ub_user ON c.updated_by = ub_user.id
      LEFT JOIN employee ub_emp ON ub_user.id = ub_emp.user_id
      LEFT JOIN auditor ub_aud ON ub_user.id = ub_aud.user_id
      LEFT JOIN reviewer ub_rev ON ub_user.id = ub_rev.user_id
      LEFT JOIN subadmin ub_sub ON ub_user.id = ub_sub.user_id
      WHERE c.id = $1`,
      [id],
    )) as QueryResult<
      Certificate & {
        industry_names?: string[];
        created_by_name?: string;
        updated_by_name?: string;
      }
    >;

    if (!certResult.rows[0]) return null;

    const certificate = certResult.rows[0];

    const badgesResult = (await this.db.query(
      `SELECT b.*, 
        COALESCE(
          json_agg(
            json_build_object('id', bc.id, 'color', bc.color, 'min_score', bc.min_score, 'max_score', bc.max_score)
          ) FILTER (WHERE bc.id IS NOT NULL), '[]'
        ) as colors
       FROM badges b
       LEFT JOIN badge_colors bc ON bc.badge_id = b.id
       WHERE b.certificate_id = $1
       GROUP BY b.id
       ORDER BY b.slot`,
      [id],
    )) as QueryResult<Badge & { colors: any[] }>;

    const mainSectionsResult = (await this.db.query(
      `SELECT * FROM main_section WHERE certificate_id = $1 ORDER BY rank`,
      [id],
    )) as QueryResult<MainSection>;

    const mainSections: Array<
      MainSection & {
        sections: Array<
          Section & {
            questions: Question[];
            sub_sections: Array<SubSection & { questions: Question[] }>;
          }
        >;
      }
    > = [];
    const allQuestionsResult = (await this.db.query(
      `SELECT
        q.id, q.certificate_id, q.main_section_id, q.section_id, q.sub_section_id,
        q.question, q.hint, q.type, q.is_third_level, q.criteria,
        q.ai_review_enabled, q.ai_review_criteria, q.ai_review_score,
        q.yes_score, q.no_score, q.conditional_logic_enabled, q.conditional_logic,
        q.options,
        q.rank, q.question_number, q.certificate_question_number, q.score,
        q.parent_question_id, q.parent_trigger_value,
        q.created_at, q.updated_at,
        s.name as section_name,
        ss.name as sub_section_name
       FROM questions q
       LEFT JOIN sections s ON q.section_id = s.id
       LEFT JOIN sub_section ss ON q.sub_section_id = ss.id
       WHERE q.certificate_id = $1
       ORDER BY q.rank ASC`,
      [id],
    )) as QueryResult<Question>;

    const questionsBySection: Record<string, Question[]> = {};
    const questionsBySubSection: Record<string, Question[]> = {};

    const totalQuestions = allQuestionsResult.rows.length;

    for (const q of allQuestionsResult.rows) {
      const question: Question = {
        ...q,
      };

      if (question.sub_section_id) {
        questionsBySubSection[question.sub_section_id] =
          questionsBySubSection[question.sub_section_id] || [];
        questionsBySubSection[question.sub_section_id].push(question);
      } else if (question.section_id) {
        questionsBySection[question.section_id] =
          questionsBySection[question.section_id] || [];
        questionsBySection[question.section_id].push(question);
      }
    }

    // Bulk-load all sections and sub_sections for this certificate (avoids N+1)
    const allSectionsResult = (await this.db.query(
      `SELECT * FROM sections WHERE certificate_id = $1 ORDER BY rank`,
      [id],
    )) as QueryResult<Section>;

    const allSubSectionsResult = (await this.db.query(
      `SELECT * FROM sub_section WHERE certificate_id = $1 ORDER BY rank`,
      [id],
    )) as QueryResult<SubSection>;

    // Group sections by main_id, sub_sections by section_id
    const sectionsByMainId: Record<string, Section[]> = {};
    for (const section of allSectionsResult.rows) {
      sectionsByMainId[section.main_id] = sectionsByMainId[section.main_id] || [];
      sectionsByMainId[section.main_id].push(section);
    }

    const subSectionsBySectionId: Record<string, SubSection[]> = {};
    for (const subSection of allSubSectionsResult.rows) {
      subSectionsBySectionId[subSection.section_id] = subSectionsBySectionId[subSection.section_id] || [];
      subSectionsBySectionId[subSection.section_id].push(subSection);
    }

    for (const mainSection of mainSectionsResult.rows) {
      const sectionRows = sectionsByMainId[mainSection.id] || [];

      const sections: Array<
        Section & {
          questions: Question[];
          sub_sections: Array<SubSection & { questions: Question[]; questions_count?: number }>;
        }
      > = [];

      for (const section of sectionRows) {
        const sectionQuestions = questionsBySection[section.id] || [];
        const subSectionRows = subSectionsBySectionId[section.id] || [];

        const subSections = subSectionRows.map((subSection) => {
          const raw = questionsBySubSection[subSection.id] || [];
          const grouped = groupSubQuestions(raw);
          return {
            ...subSection,
            questions: grouped,
            questions_count: raw.filter((q) => !q.parent_question_id).length,
          };
        });

        const grouped = groupSubQuestions(sectionQuestions);

        sections.push({
          ...section,
          questions: grouped,
          questions_count: sectionQuestions.filter((q) => !q.parent_question_id).length,
          sub_sections: subSections,
        });
      }

      mainSections.push({
        ...mainSection,
        sections,
      });
    }

    return {
      ...certificate,
      badges: badgesResult.rows,
      main_sections: mainSections,
      questions_count: totalQuestions,
    };
  }

  private queryWith(client?: PoolClient): DatabaseService | PoolClient {
    return client ?? this.db;
  }

  // ── Answer-existence guards ───────────────────────────────────────────────
  // Used to give a friendly error before deleting/editing questions that already
  // have applicant answers (the DB also enforces this via ON DELETE RESTRICT).

  async countAnswersForQuestionTree(
    questionId: string,
    client?: PoolClient,
  ): Promise<number> {
    const res = (await this.queryWith(client).query(
      `WITH RECURSIVE subtree AS (
         SELECT id FROM questions WHERE id = $1
         UNION ALL
         SELECT q.id FROM questions q
           JOIN subtree s ON q.parent_question_id = s.id
       )
       SELECT COUNT(*) AS total
         FROM assessment_queries
        WHERE question_id IN (SELECT id FROM subtree)`,
      [questionId],
    )) as QueryResult<{ total: string }>;
    return parseInt(res.rows[0]?.total ?? '0', 10);
  }

  async countAnswersByStructural(
    column: 'section_id' | 'sub_section_id' | 'main_section_id',
    id: string,
    client?: PoolClient,
  ): Promise<number> {
    // `column` is a fixed whitelist (never user input) so interpolation is safe.
    const res = (await this.queryWith(client).query(
      `SELECT COUNT(*) AS total
         FROM assessment_queries aq
         JOIN questions q ON q.id = aq.question_id
        WHERE q.${column} = $1`,
      [id],
    )) as QueryResult<{ total: string }>;
    return parseInt(res.rows[0]?.total ?? '0', 10);
  }

  async deleteCertificate(id: string, client?: PoolClient): Promise<void> {
    await this.queryWith(client).query(`DELETE FROM certificates WHERE id = $1`, [id]);
  }

  async deleteQuestionsBySection(sectionId: string, client?: PoolClient): Promise<void> {
    await this.queryWith(client).query(`DELETE FROM questions WHERE section_id = $1`, [
      sectionId,
    ]);
  }

  async deleteSubSectionsBySection(sectionId: string, client?: PoolClient): Promise<void> {
    await this.queryWith(client).query(`DELETE FROM sub_section WHERE section_id = $1`, [
      sectionId,
    ]);
  }

  async deleteSection(id: string, client?: PoolClient): Promise<void> {
    await this.queryWith(client).query(`DELETE FROM sections WHERE id = $1`, [id]);
  }

  async deleteQuestionsBySubSection(subSectionId: string, client?: PoolClient): Promise<void> {
    await this.queryWith(client).query(`DELETE FROM questions WHERE sub_section_id = $1`, [
      subSectionId,
    ]);
  }

  async deleteSubSection(id: string, client?: PoolClient): Promise<void> {
    await this.queryWith(client).query(`DELETE FROM sub_section WHERE id = $1`, [id]);
  }

  async deleteQuestion(id: string, client?: PoolClient): Promise<void> {
    await this.queryWith(client).query(`DELETE FROM questions WHERE id = $1`, [id]);
  }

  async deleteQuestionsByMainSection(mainSectionId: string, client?: PoolClient): Promise<void> {
    await this.queryWith(client).query(
      `DELETE FROM questions
       WHERE main_section_id = $1
          OR section_id IN (SELECT id FROM sections WHERE main_id = $1)
          OR sub_section_id IN (
            SELECT id FROM sub_section
            WHERE section_id IN (SELECT id FROM sections WHERE main_id = $1)
          )`,
      [mainSectionId],
    );
  }

  async deleteSubSectionsByMainSection(mainSectionId: string, client?: PoolClient): Promise<void> {
    await this.queryWith(client).query(
      `DELETE FROM sub_section
       WHERE section_id IN (
         SELECT id FROM sections WHERE main_id = $1
       )`,
      [mainSectionId],
    );
  }

  async deleteSectionsByMainSection(mainSectionId: string, client?: PoolClient): Promise<void> {
    await this.queryWith(client).query(`DELETE FROM sections WHERE main_id = $1`, [
      mainSectionId,
    ]);
  }

  async deleteMainSection(id: string, client?: PoolClient): Promise<void> {
    await this.queryWith(client).query(`DELETE FROM main_section WHERE id = $1`, [id]);
  }

  // ── Reorder / rank-shift helpers ────────────────────────────────────────

  async shiftSectionRanksForInsert(
    client: PoolClient,
    mainId: string,
    fromRank: number,
    excludeId?: string,
  ): Promise<void> {
    const excludeClause = excludeId ? `AND id != $3` : '';
    const params: any[] = [mainId, fromRank];
    if (excludeId) params.push(excludeId);
    await client.query(
      `UPDATE sections SET rank = rank + 1
       WHERE main_id = $1 AND rank >= $2 ${excludeClause}`,
      params,
    );
  }

  async shiftSectionRanksForDelete(
    client: PoolClient,
    mainId: string,
    fromRank: number,
    excludeId?: string,
  ): Promise<void> {
    const excludeClause = excludeId ? `AND id != $3` : '';
    const params: any[] = [mainId, fromRank];
    if (excludeId) params.push(excludeId);
    await client.query(
      `UPDATE sections SET rank = rank - 1
       WHERE main_id = $1 AND rank > $2 ${excludeClause}`,
      params,
    );
  }

  async updateSectionParentAndRank(
    client: PoolClient,
    sectionId: string,
    mainId: string,
    rank: number,
  ): Promise<void> {
    await client.query(
      `UPDATE sections SET main_id = $1, rank = $2, updated_at = NOW() WHERE id = $3`,
      [mainId, rank, sectionId],
    );
  }

  async shiftSubSectionRanksForInsert(
    client: PoolClient,
    sectionId: string,
    fromRank: number,
    excludeId?: string,
  ): Promise<void> {
    const excludeClause = excludeId ? `AND id != $3` : '';
    const params: any[] = [sectionId, fromRank];
    if (excludeId) params.push(excludeId);
    await client.query(
      `UPDATE sub_section SET rank = rank + 1
       WHERE section_id = $1 AND rank >= $2 ${excludeClause}`,
      params,
    );
  }

  async shiftSubSectionRanksForDelete(
    client: PoolClient,
    sectionId: string,
    fromRank: number,
    excludeId?: string,
  ): Promise<void> {
    const excludeClause = excludeId ? `AND id != $3` : '';
    const params: any[] = [sectionId, fromRank];
    if (excludeId) params.push(excludeId);
    await client.query(
      `UPDATE sub_section SET rank = rank - 1
       WHERE section_id = $1 AND rank > $2 ${excludeClause}`,
      params,
    );
  }

  async updateSubSectionParentAndRank(
    client: PoolClient,
    subSectionId: string,
    sectionId: string,
    mainId: string,
    rank: number,
  ): Promise<void> {
    await client.query(
      `UPDATE sub_section SET section_id = $1, main_id = $2, rank = $3, updated_at = NOW() WHERE id = $4`,
      [sectionId, mainId, rank, subSectionId],
    );
  }

  async shiftQuestionRanksForInsert(
    client: PoolClient,
    parentId: string,
    isThirdLevel: boolean,
    fromRank: number,
    excludeId?: string,
  ): Promise<void> {
    const rankShiftOffset = 1000000;
    const colName = isThirdLevel ? 'sub_section_id' : 'section_id';
    const excludeClause = excludeId ? `AND id != $4` : '';
    const params: any[] = [parentId, isThirdLevel, fromRank];
    if (excludeId) params.push(excludeId);

    // Two-phase update avoids transient unique-index collisions while shifting.
    await client.query(
      `UPDATE questions SET rank = rank + ${rankShiftOffset}
       WHERE ${colName} = $1 AND is_third_level = $2 AND rank >= $3 ${excludeClause}`,
      params,
    );

    const paramsShiftBack: any[] = [
      parentId,
      isThirdLevel,
      fromRank + rankShiftOffset,
    ];
    if (excludeId) paramsShiftBack.push(excludeId);

    await client.query(
      `UPDATE questions SET rank = rank - ${rankShiftOffset - 1}
       WHERE ${colName} = $1 AND is_third_level = $2 AND rank >= $3 ${excludeClause}`,
      paramsShiftBack,
    );
  }

  async shiftQuestionRanksForDelete(
    client: PoolClient,
    parentId: string,
    isThirdLevel: boolean,
    fromRank: number,
    excludeId?: string,
  ): Promise<void> {
    const rankShiftOffset = 1000000;
    const colName = isThirdLevel ? 'sub_section_id' : 'section_id';
    const excludeClause = excludeId ? `AND id != $4` : '';
    const params: any[] = [parentId, isThirdLevel, fromRank];
    if (excludeId) params.push(excludeId);

    // Two-phase update avoids transient unique-index collisions while shifting.
    await client.query(
      `UPDATE questions SET rank = rank + ${rankShiftOffset}
       WHERE ${colName} = $1 AND is_third_level = $2 AND rank > $3 ${excludeClause}`,
      params,
    );

    const paramsShiftBack: any[] = [
      parentId,
      isThirdLevel,
      fromRank + rankShiftOffset,
    ];
    if (excludeId) paramsShiftBack.push(excludeId);

    await client.query(
      `UPDATE questions SET rank = rank - ${rankShiftOffset + 1}
       WHERE ${colName} = $1 AND is_third_level = $2 AND rank > $3 ${excludeClause}`,
      paramsShiftBack,
    );
  }

  async updateQuestionParentAndRank(
    client: PoolClient,
    questionId: string,
    data: {
      main_section_id: string;
      section_id: string;
      sub_section_id: string | null;
      is_third_level: boolean;
      rank: number;
      question_number: number | null;
    },
  ): Promise<void> {
    await client.query(
      `UPDATE questions
       SET main_section_id = $1, section_id = $2, sub_section_id = $3,
           is_third_level = $4, rank = $5, question_number = $6, updated_at = NOW()
       WHERE id = $7`,
      [
        data.main_section_id,
        data.section_id,
        data.sub_section_id,
        data.is_third_level,
        data.rank,
        data.question_number,
        questionId,
      ],
    );
  }

  async nullifyLocalQuestionNumbers(
    client: PoolClient,
    parentId: string,
    isThirdLevel: boolean,
  ): Promise<void> {
    const colName = isThirdLevel ? 'sub_section_id' : 'section_id';
    await client.query(
      `UPDATE questions SET question_number = NULL
       WHERE ${colName} = $1 AND is_third_level = $2`,
      [parentId, isThirdLevel],
    );
  }

  /**
   * Renumber all question_number values within a parent (section or subsection)
   * by rank order (1, 2, 3...). Called after a question moves in/out of a parent.
   */
  async renumberLocalQuestionNumbers(
    client: PoolClient,
    parentId: string,
    isThirdLevel: boolean,
  ): Promise<void> {
    const colName = isThirdLevel ? 'sub_section_id' : 'section_id';
    // Nullify first to avoid unique constraint violations during swap.
    await this.nullifyLocalQuestionNumbers(client, parentId, isThirdLevel);
    await client.query(
      `UPDATE questions q
       SET question_number = numbered.rn
       FROM (
         SELECT id, ROW_NUMBER() OVER (ORDER BY rank) AS rn
         FROM questions
         WHERE ${colName} = $1 AND is_third_level = $2
       ) AS numbered
       WHERE q.id = numbered.id`,
      [parentId, isThirdLevel],
    );
  }

  /**
   * Recalculate certificate_question_number for all questions in a certificate
   * using DFS pre-order: main_section rank → section rank → subsection rank (nulls last) → question rank.
   */
  async recalculateCertificateQuestionNumbers(
    client: PoolClient,
    certificateId: string,
  ): Promise<void> {
    // Nullify first to avoid unique constraint violations during recalculation
    await client.query(
      `UPDATE questions SET certificate_question_number = NULL WHERE certificate_id = $1`,
      [certificateId],
    );
    await client.query(
      `UPDATE questions q
       SET certificate_question_number = numbered.rn
       FROM (
         SELECT
           q2.id,
           ROW_NUMBER() OVER (
             ORDER BY
               ms.rank,
               s.rank,
               COALESCE(ss.rank, 2147483647),
               q2.rank
           ) AS rn
         FROM questions q2
         JOIN main_section ms ON ms.id = q2.main_section_id
         JOIN sections s ON s.id = q2.section_id
         LEFT JOIN sub_section ss ON ss.id = q2.sub_section_id
         WHERE q2.certificate_id = $1
       ) AS numbered
       WHERE q.id = numbered.id`,
      [certificateId],
    );
  }

  // ─── Cascade children helpers ──────────────────────────────────────────

  async recalculateHierarchicalShortCodes(
    client: PoolClient,
    certificateId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE questions SET short_code = NULL WHERE certificate_id = $1`,
      [certificateId],
    );
    await client.query(
      `UPDATE sub_section SET short_code = NULL WHERE certificate_id = $1`,
      [certificateId],
    );
    await client.query(
      `UPDATE sections SET short_code = NULL WHERE certificate_id = $1`,
      [certificateId],
    );
    await client.query(
      `UPDATE main_section SET short_code = NULL WHERE certificate_id = $1`,
      [certificateId],
    );

    await client.query(
      `UPDATE main_section ms
       SET short_code = c.short_code || ms.rank::text
       FROM certificates c
       WHERE ms.certificate_id = c.id
         AND ms.certificate_id = $1
         AND c.short_code IS NOT NULL
         AND ms.rank IS NOT NULL`,
      [certificateId],
    );

    await client.query(
      `UPDATE sections s
       SET short_code = ms.short_code || '.' || s.rank::text
       FROM main_section ms
       WHERE s.main_id = ms.id
         AND s.certificate_id = $1
         AND ms.short_code IS NOT NULL
         AND s.rank IS NOT NULL`,
      [certificateId],
    );

    await client.query(
      `UPDATE sub_section ss
       SET short_code = s.short_code || '.' || ss.rank::text
       FROM sections s
       WHERE ss.section_id = s.id
         AND ss.certificate_id = $1
         AND s.short_code IS NOT NULL
         AND ss.rank IS NOT NULL`,
      [certificateId],
    );

    await client.query(
      `UPDATE questions q
       SET short_code = s.short_code || '.0.' || q.question_number::text
       FROM sections s
       WHERE q.section_id = s.id
         AND q.certificate_id = $1
         AND q.is_third_level = FALSE
         AND q.parent_question_id IS NULL
         AND s.short_code IS NOT NULL
         AND q.question_number IS NOT NULL`,
      [certificateId],
    );

    await client.query(
      `UPDATE questions q
       SET short_code = s.short_code || '.' || ss.rank::text || '.' || q.question_number::text
       FROM sub_section ss
       JOIN sections s ON s.id = ss.section_id
       WHERE q.sub_section_id = ss.id
         AND q.certificate_id = $1
         AND q.is_third_level = TRUE
         AND q.parent_question_id IS NULL
         AND s.short_code IS NOT NULL
         AND ss.rank IS NOT NULL
         AND q.question_number IS NOT NULL`,
      [certificateId],
    );
  }

  /** Update all sub_sections and questions under a section when it moves to a different main_section */
  async cascadeSectionChildren(
    client: PoolClient,
    sectionId: string,
    newMainId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE sub_section SET main_id = $1 WHERE section_id = $2`,
      [newMainId, sectionId],
    );
    await client.query(
      `UPDATE questions SET main_section_id = $1 WHERE section_id = $2`,
      [newMainId, sectionId],
    );
  }

  /** Update all questions under a sub_section when it moves to a different section */
  async cascadeSubSectionChildren(
    client: PoolClient,
    subSectionId: string,
    newMainId: string,
    newSectionId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE questions SET main_section_id = $1, section_id = $2 WHERE sub_section_id = $3`,
      [newMainId, newSectionId, subSectionId],
    );
  }

  // ─── Promote/demote helpers ────────────────────────────────────────────

  async createMainSectionFromName(
    client: PoolClient,
    certificateId: string,
    name: string,
    rank: number,
  ): Promise<{ id: string }> {
    const result = await client.query(
      `INSERT INTO main_section (certificate_id, name, rank) VALUES ($1, $2, $3) RETURNING id`,
      [certificateId, name, rank],
    );
    return result.rows[0];
  }

  async createSectionFromName(
    client: PoolClient,
    certificateId: string,
    mainId: string,
    name: string,
    rank: number,
  ): Promise<{ id: string }> {
    const result = await client.query(
      `INSERT INTO sections (certificate_id, main_id, name, rank) VALUES ($1, $2, $3, $4) RETURNING id`,
      [certificateId, mainId, name, rank],
    );
    return result.rows[0];
  }

  async createSubSectionFromName(
    client: PoolClient,
    certificateId: string,
    mainId: string,
    sectionId: string,
    name: string,
    rank: number,
  ): Promise<{ id: string }> {
    const result = await client.query(
      `INSERT INTO sub_section (certificate_id, main_id, section_id, name, rank) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [certificateId, mainId, sectionId, name, rank],
    );
    return result.rows[0];
  }

  /** Reassign all children of a section (sub_sections + questions) to a new main_section ID */
  async reassignSectionChildrenToNewMain(
    client: PoolClient,
    oldSectionId: string,
    newMainSectionId: string,
  ): Promise<void> {
    // Move sub_sections to point at new main
    await client.query(
      `UPDATE sub_section SET main_id = $1 WHERE section_id = $2`,
      [newMainSectionId, oldSectionId],
    );
    // Move questions to point at new main
    await client.query(
      `UPDATE questions SET main_section_id = $1 WHERE section_id = $2`,
      [newMainSectionId, oldSectionId],
    );
  }

  /** Move questions from a sub_section into a section (promote: flip is_third_level to false) */
  async reassignSubSectionQuestionsToSection(
    client: PoolClient,
    subSectionId: string,
    newSectionId: string,
    newMainId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE questions
       SET section_id = $1, main_section_id = $2, sub_section_id = NULL, is_third_level = FALSE
       WHERE sub_section_id = $3`,
      [newSectionId, newMainId, subSectionId],
    );
  }

  /** Move questions from a section into a sub_section (demote: flip is_third_level to true) */
  async reassignSectionQuestionsToSubSection(
    client: PoolClient,
    sectionId: string,
    newSubSectionId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE questions
       SET sub_section_id = $1, is_third_level = TRUE
       WHERE section_id = $2 AND sub_section_id IS NULL AND is_third_level = FALSE`,
      [newSubSectionId, sectionId],
    );
  }


  // ─── Rank getters for reorder auto-assign ────────────────────────────

  async getMaxSectionRankForMainSection(client: PoolClient, mainId: string): Promise<number> {
    const result = await client.query(
      `SELECT COALESCE(MAX(rank), 0) as max_rank FROM sections WHERE main_id = $1`,
      [mainId],
    );
    return parseInt(result.rows[0].max_rank, 10);
  }

  async getMaxSubSectionRankForSection(client: PoolClient, sectionId: string): Promise<number> {
    const result = await client.query(
      `SELECT COALESCE(MAX(rank), 0) as max_rank FROM sub_section WHERE section_id = $1`,
      [sectionId],
    );
    return parseInt(result.rows[0].max_rank, 10);
  }

  async beginTransaction(): Promise<PoolClient> {
    const client = await this.db.getClient();
    await client.query('BEGIN');
    return client;
  }

  async commitTransaction(client: PoolClient): Promise<void> {
    try {
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  }

  async rollbackTransaction(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ROLLBACK failed — connection is broken, destroy instead of recycling
      client.release(true);
      return;
    }
    client.release();
  }
}
