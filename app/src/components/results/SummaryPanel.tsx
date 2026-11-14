'use client';
import type { AnalysisDoc, TrendResult } from '@/lib/types';
import { conclusionSentences } from '@/lib/story';
import FieldNote from './FieldNote';

/** "What it means": three plain statements plus an editable note the user can copy or print. */
export default function SummaryPanel({ doc, result }: { doc: AnalysisDoc; result: TrendResult }) {
  const text = conclusionSentences(doc);
  void result;
  return (
    <section className="card section">
      <h2>What it means</h2>
      <div className="meaning-grid">
        <article><h3>What we found</h3><p>{text.found}</p></article>
        <article><h3>How sure we are</h3><p>{text.sure}</p></article>
        <article><h3>What we can’t say</h3><p>{text.limits}</p></article>
      </div>
      <FieldNote doc={doc} />
    </section>
  );
}
