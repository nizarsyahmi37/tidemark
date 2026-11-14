'use client';
import type { AnalysisDoc } from '@/lib/types';
import ForestPlot from './ForestPlot';
export default function TrustChecks({ doc }: { doc: AnalysisDoc; }) {
  const agreement = doc.headline.methods_agree_with_primary;
  const verdict = { robust: 'Solid across year choices', window_dependent: 'Sensitive to the years chosen', no_clear_trend: 'No clear change across windows', insufficient: 'Not enough years to test' }[doc.heatmap.metrics.verdict];
  return <section className="trust-grid section">
    <article className="card">
      <p className="eyebrow">Check 1</p>
      <h3>Do different ways of measuring agree?</h3>
      <ForestPlot doc={doc} />
      <p>{agreement} of 4 methods agree with the selected primary analysis.</p>
    </article>
    <article className="card">
      <p className="eyebrow">Check 2</p>
      <h3>Does it depend on which years we pick?</h3>
      <span className="evidence-pill">{verdict}</span>
      <p>{doc.heatmap.metrics.verdict_text}</p>
    </article>
    <article className="card">
      <p className="eyebrow">Check 3</p>
      <h3>Is there enough data?</h3>
      <strong className="big-number">{doc.headline.n_years} years</strong>
      <p>{doc.headline.n_years < 20 ? 'This is a short record. Longer records can reveal weaker trends more clearly.' : 'There is a useful span of years, though more data can still change the estimate.'}</p>
    </article>
  </section>;
}
