"""Insert an owner-deployed production URL and narrow its manifest host access."""
import argparse,json,re
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('url');args=parser.parse_args()
if not re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]{20,200}/exec',args.url):raise SystemExit('Use the Apps Script HTTPS production /exec URL, without query parameters.')
root=Path(__file__).resolve().parent.parent
(root/'report-config.js').write_text('// Public write-only receiver URL; never put credentials here.\nconst REPORT_CONFIG = Object.freeze('+json.dumps({'endpoint':args.url})+');\n',encoding='utf8')
p=root/'manifest.json';m=json.loads(p.read_text(encoding='utf8'))
m['host_permissions']=[x for x in m['host_permissions'] if not x.startswith(('https://script.google.com/','https://script.googleusercontent.com/'))]+[args.url.rsplit('/',1)[0]+'/*','https://script.googleusercontent.com/*']
p.write_text(json.dumps(m,indent=2)+'\n',encoding='utf8')
print('Collector configured. Anonymous live receipt verification is still required before publishing.')
