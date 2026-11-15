"""Everything the claim checker needs, per study area and record, in one file.

Usage:
    python backend/claims/export_checks.py frontend/public/data     # writes checks.json

For each of the 360 areas and 10 records it stores two tests:
  average  is the record's average moving?  (backend trend: seasonal OLS + HAC(12), Benjamini-Hochberg)
  swings   are its ups and downs getting bigger or smaller? (trend in the size of detrended,
           deseasonalised monthly departures, HAC(12), Benjamini-Hochberg across all areas and records)
plus plain-language helpers:
  typical swing size in 2000-09 vs 2015-24, in the record's own units
  how often a "1-in-10 month" (biggest 10% of departures in 2000-09) happened in 2015-24
  whether the swing change lines up with ~2014, when several NASA input streams changed
  the second NASA system's answer, where one exists (rain: MERRA-2 vs GPM IMERG; soil: MERRA-2 vs GLDAS)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'intel'))
import detectors as D  # noqa: E402

ALPHA = 0.05
# Records whose swing changes cluster around 2013-15 across the globe (see detectors check):
# satellite rain switched missions and model inputs changed then. A swing change that
# lines up with that window is flagged, not hidden.
SWITCH_PRONE = {'T2M', 'aerosol', 'dust', 'gpm_rain'}
SECOND = {'PRECTOTCORR': 'gpm_rain', 'gpm_rain': 'PRECTOTCORR', 'GWETTOP': 'soil_moisture', 'soil_moisture': 'GWETTOP'}


def r(x, d=4):
    return None if x is None or not np.isfinite(x) else round(float(x), d)


def best_split_year(a):
    best = None
    for k in range(36, len(a) - 36, 6):
        m1, m2 = a[:k].mean(), a[k:].mean()
        sse = ((a[:k] - m1) ** 2).sum() + ((a[k:] - m2) ** 2).sum()
        if best is None or sse < best[0]:
            best = (sse, k)
    return 2000 + best[1] // 12


def main(data_dir):
    data_dir = Path(data_dir)
    regions, trends, series = D.load(data_dir)
    T = trends['variables']
    n = len(regions)
    vol = D.volatility(series)
    vol_q = D.bh([p for v in D.VARS for _, p in vol[v]]).reshape(len(D.VARS), -1)

    out = {'alpha': ALPHA, 'n_tests_average': trends['n_tests'],
           'n_tests_swings': int(np.isfinite(vol_q).sum()), 'records': {}}
    for j, v in enumerate(D.VARS):
        resid = D.detrend(D.anomalies(series[v]))
        rec = {k: [None] * n for k in (
            'avg_slope', 'avg_lo', 'avg_hi', 'avg_q', 'avg_p',
            'swing_pct', 'swing_q', 'swing_early', 'swing_late', 'rare_late', 'switch_flag')}
        for i in range(n):
            s = T[v]['slope'][i]
            if s is not None:
                rec['avg_slope'][i] = s
                rec['avg_lo'][i] = T[v]['ci_low'][i]
                rec['avg_hi'][i] = T[v]['ci_high'][i]
                rec['avg_q'][i] = T[v]['p_bh'][i]
                rec['avg_p'][i] = T[v]['p_raw'][i]
            row = resid[i]
            if not np.isfinite(row).all() or np.nanstd(row) == 0:
                continue
            a = np.abs(row)
            rec['swing_pct'][i] = r(vol[v][i][0], 1)
            rec['swing_q'][i] = r(vol_q[j, i], 5)
            rec['swing_early'][i] = r(a[:120].mean(), 4)   # 2000-2009
            rec['swing_late'][i] = r(a[-120:].mean(), 4)   # 2015-2024
            thr = np.quantile(a[:120], 0.9)
            rec['rare_late'][i] = r(float(np.mean(a[-120:] > thr)), 3)
            if v in SWITCH_PRONE and vol_q[j, i] < ALPHA:
                rec['switch_flag'][i] = 2013 <= best_split_year(a) <= 2015
        out['records'][v] = rec
    out['second_system'] = SECOND
    out['switch_prone'] = sorted(SWITCH_PRONE)
    (data_dir / 'checks.json').write_text(json.dumps(out, separators=(',', ':')))
    sig_sw = int(np.nansum(vol_q < ALPHA))
    flagged = sum(1 for v in D.VARS for f in out['records'][v]['switch_flag'] if f)
    print(json.dumps({'swing_significant': sig_sw, 'switch_flagged': flagged,
                      'bytes': (data_dir / 'checks.json').stat().st_size}))


if __name__ == '__main__':
    main(sys.argv[1])
