'use client';
import type { AnalysisDoc } from '@/lib/types';
import ResultsView from './results/ResultsView';
export default function Results({ initial }: { initial?: AnalysisDoc; }) { return <ResultsView initial={initial} />; }
