import { useEffect, useState } from 'react';
export type ChartTheme = { ink: string; muted: string; line: string; teal: string; amber: string; };
export function useChartTheme() {
  const [theme, setTheme] = useState<ChartTheme>({ ink: '#18312f', muted: '#526965', line: '#d9e4e1', teal: '#087f73', amber: '#dc7834' });
  useEffect(() => {
    const update = () => {
      const css = getComputedStyle(document.documentElement);
      setTheme({ ink: css.getPropertyValue('--ink').trim(), muted: css.getPropertyValue('--muted').trim(), line: css.getPropertyValue('--line').trim(), teal: css.getPropertyValue('--teal').trim(), amber: css.getPropertyValue('--orange').trim() || '#dc7834' });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}
