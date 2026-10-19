"""Download official Chrome for Testing into an isolated, ignored test folder."""
import argparse
import json
import os
from pathlib import Path
import platform
import stat
import urllib.request
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('channel', choices=['minimum', 'stable'])
args = parser.parse_args()
minimum = json.loads((Path(__file__).resolve().parent.parent / 'manifest.json').read_text(encoding='utf8'))['minimum_chrome_version']
base = 'https://googlechromelabs.github.io/chrome-for-testing/'
metadata = base + (minimum + '.json' if args.channel == 'minimum' else 'last-known-good-versions-with-downloads.json')
with urllib.request.urlopen(metadata, timeout=30) as response:
    data = json.load(response)
if args.channel == 'stable':
    data = data['channels']['Stable']
target = 'win64' if platform.system() == 'Windows' else 'linux64'
if platform.system() not in ['Windows', 'Linux'] or platform.machine().lower() not in ['amd64', 'x86_64']:
    raise SystemExit('This test installer supports Windows/Linux x64 only.')
download = next(x for x in data['downloads']['chrome'] if x['platform'] == target)
if not download['url'].startswith('https://storage.googleapis.com/chrome-for-testing-public/'):
    raise SystemExit('Unexpected Chrome download host/path')
root = Path(__file__).resolve().parent.parent / 'test-results' / ('chrome-' + data['version'])
root.mkdir(parents=True, exist_ok=True)
exe = root / ('chrome-win64/chrome.exe' if target == 'win64' else 'chrome-linux64/chrome')
if not exe.exists():
    archive = root / 'chrome.zip'
    urllib.request.urlretrieve(download['url'], archive)
    with zipfile.ZipFile(archive) as z:
        for item in z.infolist():
            dest = (root / item.filename).resolve()
            if not dest.is_relative_to(root.resolve()):
                raise SystemExit('Unsafe archive path')
            z.extract(item, root)
            if target == 'linux64' and item.external_attr >> 16:
                dest.chmod(stat.S_IMODE(item.external_attr >> 16))
    archive.unlink()
result = {'version': data['version'], 'executable': str(exe), 'source': download['url']}
(root.parent / ('chrome-' + args.channel + '.json')).write_text(json.dumps(result, indent=2), encoding='utf8')
if os.environ.get('GITHUB_ENV'):
    with open(os.environ['GITHUB_ENV'], 'a', encoding='utf8') as env:
        env.write('CHROME_EXECUTABLE=' + str(exe) + '\nCHROME_EXPECTED_VERSION=' + data['version'] + '\n')
print(json.dumps(result))
