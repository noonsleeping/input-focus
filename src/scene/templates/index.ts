import type { TemplateId } from '../../config';
import { aiDark, aiLight } from './aiChat';
import { claudeCode } from './claudeCode';
import { codex } from './codex';
import { searchButton } from './searchButton';
import { searchPill } from './searchPill';
import type { Template } from './types';

export const TEMPLATES: Record<TemplateId, Template> = {
  'search-pill': searchPill,
  'search-button': searchButton,
  'ai-light': aiLight,
  'ai-dark': aiDark,
  'claude-code': claudeCode,
  codex,
};

export function getTemplate(id: TemplateId): Template {
  return TEMPLATES[id] ?? searchPill;
}
