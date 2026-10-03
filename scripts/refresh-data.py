"""Refresh the pinned 2026/27 public snapshot, with rollback on validation errors."""
import datetime as dt
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
database = ROOT / 'public/data/database.json'
cache = ROOT / '.cache'
cache.mkdir(exist_ok=True)
stamp = dt.datetime.now().strftime('%Y%m%d-%H%M%S')
backup = cache / ('database-before-refresh-' + stamp + '.json')
shutil.copy2(database, backup)
scripts = ['import-data.py', 'expand-data.py',
           'complete-lower-data.py', 'finish-special-rosters.py',
           'finish-dutch-reserves.py', 'finalize-data.py', 'enrich-player-profiles.py',
           'collect-official-portraits.py', 'enrich-portraits.py']
try:
    for script in scripts:
        print('Refreshing 2026/27:', script, flush=True)
        subprocess.run([sys.executable, str(ROOT / 'scripts' / script)]+(['--all'] if script == 'enrich-player-profiles.py' else []), cwd=ROOT, check=True)
        if script == 'import-data.py':
            shutil.copy2(database, cache / 'database-before-expansion.json')
    result = json.loads(database.read_text())
    assert len(result['competitions']) == 3
    assert len(result['clubs']) >= 550 and len(result['players']) >= 15000
except BaseException:
    shutil.copy2(backup, database)
    print('Database restored from:', backup, file=sys.stderr)
    raise
print('Snapshot refreshed. Run npm test and npm run build. Existing careers retain their snapshot.')
