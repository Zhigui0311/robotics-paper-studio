#!/usr/bin/env python3
"""Validate the release version and extract its hand-written changelog section."""
import argparse
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--tag')
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    version = json.loads((ROOT / 'package.json').read_text())['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise SystemExit('package.json must use a release version X.Y.Z.')
    if args.tag and args.tag != 'v' + version:
        raise SystemExit('Tag does not match package.json version.')
    text = (ROOT / 'CHANGELOG.md').read_text(encoding='utf-8')
    match = re.search(r'^## \[' + re.escape(version) + r'\] - \d{4}-\d{2}-\d{2}\n(.*?)(?=^## \[|\Z)', text, re.M | re.S)
    if not match or not match.group(1).strip():
        raise SystemExit('CHANGELOG.md needs nonempty release notes for ' + version)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(match.group(1).strip() + '\n', encoding='utf-8')
    print('Release version verified: ' + version)


if __name__ == '__main__':
    main()
