"""Production packaging refuses an unconfigured report receiver."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

parser=argparse.ArgumentParser()
parser.add_argument('--output',required=True)
parser.add_argument('--allow-unconfigured-preview',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'manifest.json').read_text(encoding='utf8'))
package=json.loads((root/'package.json').read_text(encoding='utf8'))
assert manifest['version']==package['version'],'Manifest/package version mismatch'
config=(root/'report-config.js').read_text(encoding='utf8')
match=re.search(r'[\'"]?endpoint[\'"]?\s*:\s*[\'"]([^\'"]*)',config)
endpoint=match.group(1) if match else ''
configured=bool(re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]{20,200}/exec',endpoint))
output=Path(args.output).resolve()
if output.exists():raise SystemExit('ZIP already exists. Choose a new filename; existing files are never overwritten.')
if not configured:
    if not args.allow_unconfigured_preview or not output.name.endswith('.preview.zip'):
        raise SystemExit('Report receiver is not configured. Deploy the collector, then run scripts/configure_collector.py. Production ZIP refused.')
files=json.loads((root/'scripts/package-files.json').read_text(encoding='utf8'))
output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(output,'x',zipfile.ZIP_DEFLATED) as z:
    for name in files:z.write(root/name,name)
with zipfile.ZipFile(output) as z:
    assert z.testzip() is None and set(z.namelist())==set(files)
    for name in files:assert z.read(name)==(root/name).read_bytes(),name
print(json.dumps({'zip':str(output),'version':manifest['version'],'report_delivery_configured':configured,'files':len(files),'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}))
