'use client';
import { useState } from 'react';
import type { AnalysisDoc } from '@/lib/types';
import { conclusionSentences } from '@/lib/story';
export default function FieldNote({ doc }: { doc: AnalysisDoc; }) {
  const [note, setNote] = useState(() => conclusionSentences(doc).note);
  return <section className="card">
    <h2>Your field note</h2>
    <p>Copy a short, editable summary for a report or presentation.</p>
    <label className="field">Summary<textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} />
    </label>
    <div className="actions">
      <button className="btn" onClick={() => navigator.clipboard?.writeText(note)}>Copy note</button>
      <button className="btn" onClick={() => window.print()}>Print / save PDF</button>
    </div>
  </section>;
}
