"""Compatibility entry point: verified names/profiles replace shirt-number joins."""
import subprocess
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
for script,args in [('collect-official-portraits.py',[]),('enrich-portraits.py',['--official-only'])]:
    subprocess.run([sys.executable,str(ROOT/'scripts'/script),*args],cwd=ROOT,check=True)
