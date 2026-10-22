import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import zipfile

MODULE_PATH = Path(__file__).resolve().parents[1] / 'scripts' / 'export-public.py'
spec = importlib.util.spec_from_file_location('public_export', MODULE_PATH)
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)
package_spec = importlib.util.spec_from_file_location('skill_package', MODULE_PATH.with_name('package-skill.py'))
packager = importlib.util.module_from_spec(package_spec)
package_spec.loader.exec_module(packager)


class PublicExportTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / 'source'
        self.out = self.root / 'public'
        self.source.mkdir()
        subprocess.run(['git', 'init', '--quiet', '--initial-branch=main'], cwd=self.source, check=True)
        self.original_root = exporter.ROOT
        exporter.ROOT = self.source
        values = {
            'LICENSE': 'MIT\n', 'README.md': '# Test source\n',
            'package.json': json.dumps({'version': '0.2.0'}),
            '.openai/hosting.json': json.dumps({'project_id': 'private-test-id', 'd1': 'DB', 'r2': 'BUCKET', 'capabilities': ['mcp']}),
            'skills/robotics-paper-workbench/SKILL.md': '# Test Skill\n',
            'app/page.tsx': 'export default function Page(){}\n',
            '.wrangler/state/private.db': 'test-only private data',
            '.env.local': 'test-only environment',
            'public/pdf/example.bin': 'generated dependency',
            'robotics-paper-library/notes/test.md': 'private test note',
        }
        for name, value in values.items():
            self.write(name, value)
        subprocess.run(['git', 'add', '--all'], cwd=self.source, check=True)

    def tearDown(self):
        exporter.ROOT = self.original_root
        self.temp.cleanup()

    def write(self, name, value):
        path = self.source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value)

    def test_export_keeps_source_and_excludes_identity_and_runtime_data(self):
        exporter.export(self.out)
        self.assertTrue((self.out / 'app/page.tsx').is_file())
        hosting = json.loads((self.out / '.openai/hosting.json').read_text())
        self.assertNotIn('project_id', hosting)
        self.assertEqual(hosting['d1'], 'DB')
        for name in ('.git', '.wrangler', '.env.local', 'public/pdf', 'robotics-paper-library'):
            self.assertFalse((self.out / name).exists(), name)
        self.assertEqual(json.loads((self.source / '.openai/hosting.json').read_text())['project_id'], 'private-test-id')

    def test_untracked_backups_and_private_platform_configuration_are_not_exported(self):
        self.write('docs/private-reading-session.json', 'untracked private note')
        self.write('public/downloads/my-library.zip', 'private library backup')
        self.write('.openai/private-config.json', 'private configuration')
        subprocess.run(['git', 'add', '.openai/private-config.json', 'public/downloads/my-library.zip'], cwd=self.source, check=True)
        exporter.export(self.out)
        for name in ('docs/private-reading-session.json', 'public/downloads/my-library.zip', '.openai/private-config.json'):
            self.assertFalse((self.out / name).exists(), name)

    def test_updates_owned_files_but_stops_for_independent_changes(self):
        exporter.export(self.out)
        self.write('app/page.tsx', 'updated source\n')
        exporter.export(self.out)
        self.assertEqual((self.out / 'app/page.tsx').read_text(), 'updated source\n')
        (self.out / 'app/page.tsx').write_text('independent contributor edit\n')
        with self.assertRaisesRegex(ValueError, 'independently'):
            exporter.export(self.out)
        self.assertEqual((self.out / 'app/page.tsx').read_text(), 'independent contributor edit\n')

    def test_prevents_symlink_escape_and_export_inside_source(self):
        with self.assertRaises(ValueError):
            exporter.export(self.source / 'nested')
        link = self.root / 'link'
        link.symlink_to(self.root / 'elsewhere')
        with self.assertRaises(ValueError):
            exporter.export(link)

    def test_skill_zip_excludes_untracked_notes_and_is_reproducible(self):
        original = packager.ROOT, packager.SOURCE, packager.OUTPUT
        try:
            packager.ROOT = self.source
            packager.SOURCE = self.source / 'skills/robotics-paper-workbench'
            packager.OUTPUT = self.source / 'public/downloads/robotics-paper-workbench.zip'
            self.write('skills/robotics-paper-workbench/private-reading-session.md', 'untracked personal note')
            packager.package()
            first = packager.OUTPUT.read_bytes()
            with zipfile.ZipFile(packager.OUTPUT) as archive:
                self.assertIn('robotics-paper-workbench/SKILL.md', archive.namelist())
                self.assertNotIn('robotics-paper-workbench/private-reading-session.md', archive.namelist())
            packager.package()
            self.assertEqual(first, packager.OUTPUT.read_bytes())
        finally:
            packager.ROOT, packager.SOURCE, packager.OUTPUT = original


if __name__ == '__main__':
    unittest.main()
