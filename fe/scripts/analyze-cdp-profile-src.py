#!/usr/bin/env python3
import json, sys
from collections import defaultdict
from pathlib import Path

path = Path(sys.argv[1])
label = sys.argv[2] if len(sys.argv) > 2 else path.stem
profile = json.loads(path.read_text(encoding='utf-8')).get('profile') or json.loads(path.read_text(encoding='utf-8'))
nodes = {n['id']: n for n in profile.get('nodes', [])}
samples = profile.get('samples', [])
deltas = profile.get('timeDeltas', [])
totals = defaultdict(int)
for i, sid in enumerate(samples):
    d = deltas[i] if i < len(deltas) else 0
    seen = set()
    nid = sid
    while nid is not None and nid not in seen:
        seen.add(nid)
        n = nodes.get(nid)
        if not n:
            break
        cf = n.get('callFrame', {})
        fn = cf.get('functionName') or '(anonymous)'
        url = cf.get('url') or ''
        if '/src/' in url or 'chartExecute' in fn or 'render' in fn.lower():
            file = url.split('/src/')[-1] if '/src/' in url else url.split('/')[-1]
            totals[f'{fn} | {file}'] += d
        nid = n.get('parent')
ranked = sorted(totals.items(), key=lambda x: x[1], reverse=True)[:12]
print(json.dumps({'label': label, 'top3': [{'name': k, 'ms': round(v/1000)} for k,v in ranked[:3]], 'full': [{'name': k, 'ms': round(v/1000)} for k,v in ranked]}, ensure_ascii=False, indent=2))
