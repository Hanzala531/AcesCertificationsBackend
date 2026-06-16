export interface Certificate {
  id: string;
  certificate_id: string;
  short_code?: string | null;
  name: string;
  industry_ids?: string[];
  disclosure_price: number;
  assured_price?: number;
  validity_days?: number;
  validity_months?: number;
  validity_years?: number;
  compulsory_docs?: string[];
  description?: string;
  is_published: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: Date;
  updated_at: Date;
  questions_count?: number;
}

export interface Badge {
  id: string;
  certificate_id: string;
  slot: number;
  name: string;
  color?: string;
  score?: number;
  created_at: Date;
  updated_at: Date;
}

export interface BadgeColor {
  id: string;
  badge_id: string;
  color: string;
  min_score: number;
  max_score: number;
  created_at: Date;
}

export interface MainSection {
  id: string;
  certificate_id: string;
  name: string;
  short_code?: string | null;
  rank: number;
  created_at: Date;
  updated_at: Date;
}

export interface Section {
  id: string;
  certificate_id: string;
  main_id: string;
  name: string;
  short_code?: string | null;
  rank: number;
  created_at: Date;
  updated_at: Date;
  questions_count?: number;
}

export interface SubSection {
  id: string;
  certificate_id: string;
  main_id: string;
  section_id: string;
  name: string;
  short_code?: string | null;
  rank: number;
  created_at: Date;
  updated_at: Date;
  questions_count?: number;
}

export interface Question {
  id: string;
  certificate_id: string;
  main_section_id: string;
  section_id: string;
  section_name?: string;
  sub_section_id?: string | null;
  sub_section_name?: string;
  question: string;
  short_code?: string | null;
  hint?: string;
  type: QuestionType;
  is_third_level: boolean;
  criteria?: string;
  ai_review_enabled: boolean;
  ai_review_criteria?: string | null;
  ai_review_score?: number | null;
  yes_score?: number | null;
  no_score?: number | null;
  conditional_logic_enabled: boolean;
  conditional_logic?: QuestionConditionalLogic | null;
  options?: string[] | null;
  rank: number;
  score: number;
  is_compulsory?: boolean;
  question_number?: number;
  certificate_question_number?: number;
  parent_question_id?: string | null;
  parent_trigger_value?: 'yes' | 'no' | null;
  yes_sub_questions?: Question[];
  no_sub_questions?: Question[];
  created_at: Date;
  updated_at: Date;
}

export interface NestedQuestion extends Question {
  parent_question_id: string;
  parent_trigger_value: 'yes' | 'no';
}

export enum ConditionalTargetType {
  MAIN_SECTION = 'main_section',
  SECTION = 'section',
  SUB_SECTION = 'sub_section',
  QUESTION = 'question',
}

export interface ConditionalLogicTarget {
  target_type: ConditionalTargetType;
  target_id: string;
}

export interface ConditionalLogicAction {
  redirect_to?: ConditionalLogicTarget | null;
  blocked_sections?: ConditionalLogicTarget[];
  allowed_sections?: ConditionalLogicTarget[];
}

export interface QuestionConditionalLogic {
  yes?: ConditionalLogicAction;
  no?: ConditionalLogicAction;
}

export enum QuestionType {
  BOOLEAN = 'boolean',
  TEXT = 'text',
  MULTIPLE_CHOICE = 'multiple_choice',
  RATING = 'rating',
  NUMBER = 'number',
  FILE = 'file',
  CHECKBOX = 'checkbox',
}

export enum ParentType {
  MAIN = 'main',
  SECTION = 'section',
}

export enum SectionType {
  SECTION = 'section',
  SUB_SECTION = 'sub_section',
}

export interface CreatedSection {
  id: string;
  name: string;
  rank: number;
  level?: number;
}

export interface CreatedQuestion {
  id: string;
  question: string;
  short_code?: string | null;
  rank: number;
  question_number?: number;
}
