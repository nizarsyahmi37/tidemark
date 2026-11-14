'use client';
import type { AnalysisDoc } from '@/lib/types';
export default function Disclosure({ doc }: { doc: AnalysisDoc; }) {
  return <details className="card section">
    <summary>Show the maths · how we calculated this</summary>
    <div className="disclosure-copy">
      <p>
        <b>Sen slope:</b> the median of all pairwise slopes between observations, scaled to a decade.</p>
      <p>
        <b>Mann–Kendall:</b> uses the signed pair comparisons S and its variance, with a correction for tied values. Gilbert confidence limits describe uncertainty in the trend slope.</p>
      <p>
        <b>Seasonal Mann–Kendall:</b> combines comparisons within matching calendar months. The Hamed–Rao correction adjusts variance when yearly residuals are autocorrelated.</p>
      <p>
        <b>Window sweep:</b> repeats the primary trend calculation for each available start/end year pair with at least {doc.heatmap.min_years} years. Overlapping windows are dependent; the sweep describes sensitivity and is not a multiple independent test.</p>
      <p>
        <b>Limitations:</b> missing or incomplete months can reduce the record. Reanalysis estimates blend observations and models, and this analysis does not establish cause.</p>
    </div>
  </details>;
}
