'use client';
import Link from 'next/link';
import type { AnalysisDoc, TrendResult } from '@/lib/types';
export default function ResultHeader({ doc, result }: { doc: AnalysisDoc; result: TrendResult; }) {
  void result;
  return <>
    <div className="breadcrumbs"><Link href="/">Home</Link> / <Link href="/explore">Investigate</Link> / Results</div>
    <header className="results-head">
      <div>
        <div className="eyebrow">{doc.variable.name} · {doc.provenance?.source || doc.variable.source}</div>
        <h1 className="results-title">{doc.title}</h1>
        <div className="muted">{doc.region.name} · {doc.period.start.slice(0, 4)}–{doc.period.end.slice(0, 4)} · {doc.season.label} · {doc.headline.n_years} years of data</div>
      </div>
      <Link className="btn" href="/explore">Edit question</Link>
    </header>
  </>;
}
