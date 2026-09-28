export type SegKind = 'cjk' | 'cjkPunct' | 'en' | 'enPunct' | 'space';

export interface Segment {
  kind: SegKind;
  /** grapheme index of the first grapheme in the whole text */
  start: number;
  graphemes: string[];
}

const graphemeSegmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });
const wordSegmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });

const HAN = /\p{Script=Han}/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const WHITESPACE = /^\s+$/u;
const FULLWIDTH_PUNCT = /[　-〿＀-￯‘-”…—·]/u;

export function splitGraphemes(s: string): string[] {
  return Array.from(graphemeSegmenter.segment(s), (x) => x.segment);
}

export function classify(s: string): SegKind {
  if (HAN.test(s)) return 'cjk';
  if (WHITESPACE.test(s)) return 'space';
  if (LETTER_OR_DIGIT.test(s)) return 'en';
  return FULLWIDTH_PUNCT.test(s) ? 'cjkPunct' : 'enPunct';
}

export function isCjkKind(kind: SegKind): boolean {
  return kind === 'cjk' || kind === 'cjkPunct';
}

/** Split text into word-level segments (Chinese words via Intl.Segmenter, English words, spaces, punctuation). */
export function segmentText(text: string): Segment[] {
  const out: Segment[] = [];
  let start = 0;
  for (const { segment } of wordSegmenter.segment(text)) {
    const graphemes = splitGraphemes(segment);
    out.push({ kind: classify(segment), start, graphemes });
    start += graphemes.length;
  }
  return out;
}
