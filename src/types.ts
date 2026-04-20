export interface Section {
  id: string;
  title: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export type RuleType = 'ALWAYS_INCLUDE' | 'CONDITIONAL';

export interface Article {
  id: string;
  sectionId?: string;
  articleCode?: string;
  title: string;
  content: string;
  order: number;
  ruleType?: RuleType;
  conditionField?: string;
  conditionValue?: string;
  conditionOperator?: string;
  condition_generation?: string;
  variables_requises?: string[];
  createdAt: number;
  updatedAt: number;
}
