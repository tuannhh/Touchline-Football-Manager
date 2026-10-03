"""Refresh real portraits only; team rosters, gameplay and careers are untouched."""
import datetime as dt
from pathlib import Path
import shutil
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
backup=ROOT/'.cache'/('database-before-portraits-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S')+'.json')
shutil.copy2(ROOT/'public/data/database.json',backup)
for script in ['collect-official-portraits.py','enrich-portraits.py']:
    subprocess.run([sys.executable,str(ROOT/'scripts'/script)],cwd=ROOT,check=True)
print('Portraits refreshed. Run npm run build to publish local assets. Backup:',backup)
