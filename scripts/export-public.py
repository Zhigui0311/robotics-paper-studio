#!/usr/bin/env python3
"""Export source without a managed Site identity, credentials or research data.

The destination is an independent checkout; its Git history is never copied,
reset or pushed by this script. Existing independent edits cause a conflict.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MARKER = '.public-export.json'
DIRECTORIES = {'.github', '.openai', 'app', 'components', 'db', 'docs', 'drizzle', 'examples', 'hooks', 'lib', 'public', 'scripts', 'skills', 'tests', 'vendor', 'worker'}
FILES = {'.gitignore', '.npmrc', 'AGENTS.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md', 'cloudflare-env.d.ts', 'components.json', 'drizzle.config.ts', 'eslint.config.mjs', 'next.config.ts', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'postcss.config.mjs', 'tsconfig.json', 'vite.config.ts'}
BLOCKED_PARTS = {'.git', 'node_modules', '.wrangler', '.sites-runtime', '__pycache__', '.agents', '.codex', 'robotics-paper-library', 'attachments', 'notes', 'backups', 'dist', '.next', '.vinext', 'out', 'outputs', 'work', 'coverage'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def allowed(name):
    p = Path(name)
    if p.is_absolute() or '..' in p.parts or any(x in BLOCKED_PARTS for x in p.parts):
        return False
    if p.parts[:2] == ('public', 'pdf') or p.name.startswith(('.env', '.dev.vars')):
        return False
    if p.parts[0] == '.openai' and name != '.openai/hosting.json':
        return False
    if p.parts[:2] == ('public', 'downloads') and name != 'public/downloads/robotics-paper-workbench.zip':
        return False
    if p.suffix in {'.pem', '.key', '.sqlite', '.sqlite3', '.db', '.pyc', '.tsbuildinfo', '.log'} or p.name == '.DS_Store':
        return False
    return name in FILES or len(p.parts) > 1 and p.parts[0] in DIRECTORIES


def collect():
    names = subprocess.check_output(['git', 'ls-files', '--cached', '-z'], cwd=ROOT).decode().split('\0')
    result = {}
    for name in sorted(set(names)):
        if not name or not allowed(name):
            continue
        path = ROOT / name
        if not path.exists():
            continue
        if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(ROOT.resolve()):
            raise ValueError('Not a regular project source file: ' + name)
        if path.stat().st_size > 10 * 1024 * 1024:
            raise ValueError('Unexpectedly large source file: ' + name)
        data = path.read_bytes()
        if name == '.openai/hosting.json':
            raw = json.loads(data)
            safe = {k: raw[k] for k in ('d1', 'r2', 'capabilities') if k in raw}
            data = (json.dumps(safe, indent=2) + '\n').encode()
        result[name] = data
    for name in ('LICENSE', 'README.md', 'package.json', '.openai/hosting.json', 'skills/robotics-paper-workbench/SKILL.md'):
        if name not in result:
            raise ValueError('Required public source missing: ' + name)
    return result


def export(destination):
    if destination.is_symlink():
        raise ValueError('Destination must not be a symlink.')
    destination = destination.resolve()
    if destination == ROOT.resolve() or destination.is_relative_to(ROOT.resolve()) or ROOT.resolve().is_relative_to(destination):
        raise ValueError('Choose a separate public checkout outside the source tree.')
    if destination.is_symlink():
        raise ValueError('Destination must not be a symlink.')
    if (destination / '.git').exists():
        dirty = subprocess.check_output(['git', 'status', '--porcelain'], cwd=destination).strip()
        if dirty:
            raise ValueError('Public checkout has uncommitted changes. Review and commit them before synchronizing.')
    marker = destination / MARKER
    previous = json.loads(marker.read_text())['files'] if marker.exists() else {}
    if destination.exists() and not marker.exists() and any(p.name != '.git' for p in destination.iterdir()):
        raise ValueError('Destination is not an empty checkout or a previous public export.')
    files = collect()
    for name, expected in previous.items():
        p = Path(name)
        if not allowed(name):
            raise ValueError('Invalid path in public export manifest.')
        target = destination / p
        if target.is_symlink() or not target.resolve().is_relative_to(destination):
            raise ValueError('Unsafe destination path: ' + name)
        if not target.exists() and name in files:
            raise ValueError('Public source was deleted independently; reconcile first: ' + name)
        if target.exists() and digest(target.read_bytes()) != expected and files.get(name) != target.read_bytes():
            raise ValueError('Public source changed independently; reconcile first: ' + name)
    for name, data in files.items():
        target = destination / name
        if target.is_symlink() or not target.resolve().is_relative_to(destination):
            raise ValueError('Unsafe destination path: ' + name)
        if target.exists() and name not in previous and target.read_bytes() != data:
            raise ValueError('Public file already exists independently; reconcile first: ' + name)
    destination.mkdir(parents=True, exist_ok=True)
    for name in set(previous) - set(files):
        target = destination / name
        if target.exists():
            target.unlink()
    for name, data in files.items():
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    record = {'schema_version': 1, 'version': json.loads(files['package.json'])['version'], 'files': {n: digest(data) for n, data in files.items()}}
    marker.write_text(json.dumps(record, indent=2) + '\n')
    print('Exported {} public source files to {}'.format(len(files), destination))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    try:
        export(args.out)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))


if __name__ == '__main__':
    main()
