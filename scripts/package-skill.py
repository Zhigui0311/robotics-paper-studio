#!/usr/bin/env python3
"""Build a reproducible, portable Skill ZIP using the Python standard library."""
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'skills' / 'robotics-paper-workbench'
OUTPUT = ROOT / 'public' / 'downloads' / 'robotics-paper-workbench.zip'


def package():
    if not (SOURCE / 'SKILL.md').is_file():
        raise SystemExit('Skill source is missing.')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    names = subprocess.check_output(['git', 'ls-files', '--cached', '-z', '--', 'skills/robotics-paper-workbench'], cwd=ROOT).decode().split('\0')
    paths = sorted(ROOT / name for name in names if name)
    if SOURCE / 'SKILL.md' not in paths:
        raise SystemExit('Add Skill source files to Git before packaging.')
    with zipfile.ZipFile(OUTPUT, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for path in paths:
            if '__pycache__' in path.parts or path.suffix == '.pyc' or path.name == '.DS_Store':
                continue
            if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(SOURCE.resolve()):
                raise SystemExit('Skill source must contain regular, existing files only.')
            item = zipfile.ZipInfo('robotics-paper-workbench/' + path.relative_to(SOURCE).as_posix(), (2026, 1, 1, 0, 0, 0))
            item.compress_type = zipfile.ZIP_DEFLATED
            item.external_attr = 0o100644 << 16
            archive.writestr(item, path.read_bytes())
    print('Packaged public/downloads/robotics-paper-workbench.zip')


if __name__ == '__main__':
    package()
