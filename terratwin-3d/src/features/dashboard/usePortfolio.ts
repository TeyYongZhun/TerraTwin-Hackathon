/* Portfolio roll-up shared by the dashboard and the printable decision pack. */
import { useMemo } from 'react';
import { useAppPick } from '../../store/app';
import { useAnalytics, type Ranked } from '../../hooks/useAnalytics';

export const SSR2030_TARGET = 0.4;

export function usePortfolio() {
  const a = useAnalytics();
  const { portfolio, creamPool, picks, assumptions: A } = useAppPick('portfolio', 'creamPool', 'picks', 'assumptions');
  return useMemo(() => {
    const sites = portfolio.map((id) => a.byId.get(id)).filter(Boolean) as Ranked[];
    const pool = creamPool.map((id) => a.byId.get(id)).filter(Boolean) as Ranked[];
    const all = [...sites, ...pool.filter((p) => !portfolio.includes(p.site.id))];
    const sum = (rs: Ranked[], f: (r: Ranked) => number) => rs.reduce((t, r) => t + f(r), 0);
    // Screening baseline: modelled electricity of every screened building (homes + rooftops; car-park loads would double count).
    const baselineT = (sum([...a.byKind.roof, ...a.byKind.home], (r) => r.site.annualLoad) / 1000) * A.gridEF;
    const operationalT = sum(all, (r) => r.ev.finance.tco2);
    return {
      sites, pool, all, baselineT, operationalT,
      potentialT: a.township.tco2,
      kwp: sum(all, (r) => r.site.kwp), mwh: sum(all, (r) => r.ev.annualKwh / 1000), capex: sum(sites, (r) => r.ev.finance.capex),
      savings: sum(sites, (r) => r.ev.finance.annualSavings),
      poolHomes: sum(pool, (r) => r.site.homes), poolLease: sum(pool, (r) => (r.ev.finance.monthlyLease ?? 0) * r.site.homes),
      embodiedT: picks.reduce((t, p) => t + p.tco2Saved, 0), materialCost: picks.reduce((t, p) => t + p.cost, 0), picks,
      highFlags: sum(sites, (r) => r.ev.flags.filter((f) => f.severity === 'high').length),
    };
  }, [a, portfolio, creamPool, picks, A]);
}
