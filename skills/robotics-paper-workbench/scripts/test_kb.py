#!/usr/bin/env python3
"""Behavior tests using synthetic papers in isolated temporary directories."""
import copy
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).with_name('kb.py')


class LibraryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='robotics-paper-test-')
        self.base = Path(self.temp.name)
        self.root = self.base / '知识库 with spaces'
        self.run_cli('init')

    def tearDown(self):
        self.temp.cleanup()

    def run_cli(self, *args, ok=True):
        p = subprocess.run([sys.executable, str(SCRIPT), '--root', str(self.root), *map(str, args)],
                           encoding='utf-8', capture_output=True)
        self.assertEqual(p.returncode == 0, ok, p.stdout + p.stderr)
        return json.loads(p.stdout if p.returncode == 0 else p.stderr)

    def record(self, title='Synthetic dual arm policy', arxiv='2303.04137v1'):
        return {
            'schema_version': 1, 'title': title, 'authors': ['Test Author'], 'year': 2023,
            'venue': None, 'identifiers': {'arxiv': arxiv},
            'urls': {'paper': 'https://example.org/synthetic-paper'},
            'reading_status': 'skimmed', 'evidence_level': 'abstract',
            'summary': '合成测试记录：双臂操作，非真实论文分析。',
            'tags': {'task': ['bimanual-manipulation'], 'method': ['imitation-learning']},
            'sources': [{'url': 'https://example.org/synthetic-paper', 'kind': 'abstract', 'accessed': '2026-10-21'}],
            'results': [], 'relations': [], 'attachments': []
        }

    def put(self, record, note=None, update=False, ok=True):
        src = self.base / 'incoming.json'
        src.write_text(json.dumps(record, ensure_ascii=False), encoding='utf-8')
        args = ['add', '--record', src]
        if note is not None:
            note_path = self.base / 'incoming.md'
            note_path.write_text(note, encoding='utf-8')
            args += ['--note', note_path]
        if update:
            args += ['--update']
        return self.run_cli(*args, ok=ok)

    def saved(self, paper_id):
        return json.loads((self.root / 'records' / (paper_id + '.json')).read_text(encoding='utf-8'))

    def test_roundtrip_classification_and_chinese_search(self):
        result = self.put(self.record(), '# 合成笔记\n接触力与双臂协作。')
        self.assertEqual(result['id'], 'arxiv-2303-04137')
        hits = self.run_cli('search', '--query', '接触力')
        self.assertEqual([x['id'] for x in hits], [result['id']])
        self.assertEqual(len(self.run_cli('list', '--tag', 'method=imitation-learning')), 1)
        self.assertEqual(len(self.run_cli('list', '--tag', 'method=mpc')), 0)
        self.assertIn('task/bimanual-manipulation', (self.root / 'index.md').read_text())
        self.assertIn('arxiv-2303-04137', (self.root / 'bibliography.bib').read_text())
        self.assertTrue(self.run_cli('audit')['ok'])

    def test_versions_deduplicate_without_overwrite(self):
        result = self.put(self.record(), 'User note stays.')
        before = (self.root / 'records' / (result['id'] + '.json')).read_bytes()
        failure = self.put(self.record(arxiv='https://arxiv.org/pdf/2303.04137v7.pdf'), ok=False)
        self.assertIn('Already exists', failure['error'])
        self.assertEqual(before, (self.root / 'records' / (result['id'] + '.json')).read_bytes())

    def test_doi_normalization_and_title_collision(self):
        r = self.record(arxiv=None)
        r['identifiers']['doi'] = 'https://doi.org/10.1000/ABC'
        result = self.put(r)
        self.assertEqual(self.saved(result['id'])['identifiers']['doi'], '10.1000/abc')
        r['identifiers']['doi'] = 'doi:10.1000/abc'
        self.assertIn('Already exists', self.put(r, ok=False)['error'])
        r['identifiers']['doi'] = None
        self.assertIn('Possible title/year duplicate', self.put(r, ok=False)['error'])

    def test_update_preserves_note_and_records_history(self):
        result = self.put(self.record(), '# 人工批注\n保留这个结论。')
        r = self.saved(result['id'])
        r['tags']['method'].append('action-chunking')
        self.put(r, update=True)
        note = self.root / r['note_path']
        self.assertIn('保留这个结论', note.read_text())
        self.put(self.saved(result['id']), '# 人工批注\n保留这个结论。\n新增证据。', update=True)
        self.assertEqual(len(list((self.root / 'history').glob('*.json'))), 2)
        self.assertEqual(len(list((self.root / 'history').glob('*.md'))), 1)

    def test_evidence_gates(self):
        r = self.record()
        r['reading_status'] = 'analyzed'
        self.assertIn('full-text', self.put(r, '摘要不能算全文', ok=False)['error'])
        r['evidence_level'] = 'fulltext'
        self.assertIn('fulltext source', self.put(r, '仍然缺来源', ok=False)['error'])
        r['sources'][0]['kind'] = 'fulltext'
        self.assertIn('reading note', self.put(r, ok=False)['error'])
        result = self.put(r, '# 合成全文分析\n仅用于验证归档条件。')
        lower = self.saved(result['id'])
        lower['reading_status'] = 'skimmed'
        lower['evidence_level'] = 'abstract'
        self.assertIn('downgrade', self.put(lower, update=True, ok=False)['error'])

    def test_similar_reports_reasons_and_excludes_self(self):
        a = self.put(self.record())['id']
        other = self.record('Synthetic action chunking', '2304.13705')
        b = self.put(other)['id']
        unrelated = self.record('Synthetic aerial navigation', '2201.00001')
        unrelated['summary'] = ''
        unrelated['tags'] = {'task': ['navigation'], 'method': ['mpc']}
        self.put(unrelated)
        hits = self.run_cli('similar', a)
        self.assertEqual(hits[0]['id'], b)
        self.assertNotIn(a, [x['id'] for x in hits])
        self.assertIn('task', hits[0]['shared_tags'])
        self.assertEqual(hits[0]['ranking'], 'heuristic-candidate-only')

    def test_migration_with_attachments_and_export(self):
        attachment = self.root / 'attachments' / 'source.txt'
        attachment.write_text('Synthetic local source')
        r = self.record()
        r['attachments'] = ['attachments/source.txt']
        r['sources'][0]['url'] = 'attachments/source.txt'
        paper_id = self.put(r, '# 本地来源\n可迁移。')['id']
        (self.root / 'comparisons' / 'example.md').write_text('[note](../notes/' + paper_id + '.md)')
        archive = self.base / 'backup.zip'
        self.run_cli('export', '--out', archive)
        with zipfile.ZipFile(archive) as z:
            z.extractall(self.base / 'restored')
        original = self.root
        self.root = self.base / 'restored' / self.root.name
        shutil.rmtree(original)
        self.assertEqual(self.run_cli('audit')['records'], 1)
        self.assertEqual(self.run_cli('search', '--query', '可迁移')[0]['id'], paper_id)
        self.assertEqual((self.root / 'attachments' / 'source.txt').read_text(), 'Synthetic local source')
        self.run_cli('export', '--out', archive, ok=False)

    def test_unsafe_paths_and_orphan_note_are_rejected(self):
        r = self.record()
        r['id'] = '../escape'
        self.put(r, ok=False)
        r.pop('id')
        r['attachments'] = ['attachments/../../outside.txt']
        self.put(r, ok=False)
        r['attachments'] = []
        (self.root / 'notes' / 'arxiv-2303-04137.md').write_text('Existing manual note')
        self.assertIn('orphan', self.put(r, 'replacement', ok=False)['error'])
        self.assertEqual((self.root / 'notes' / 'arxiv-2303-04137.md').read_text(), 'Existing manual note')

    def test_lock_and_missing_directory(self):
        lock = self.root / '.write-lock'
        lock.write_text('existing writer')
        self.assertIn('locked', self.put(self.record(), ok=False)['error'])
        self.assertTrue(lock.exists())
        lock.unlink()
        (self.root / 'records').rmdir()
        self.assertIn('Missing library directory', self.run_cli('audit', ok=False)['error'])

    def test_malformed_metadata_and_missing_source(self):
        r = self.record()
        r['year'] = True
        self.put(r, ok=False)
        r['year'] = 2023
        r['sources'] = []
        self.put(r, ok=False)
        r = self.record()
        r['results'] = [{'metric': 'success', 'value': '90%'}]
        self.put(r, ok=False)

    def test_identifier_bridge_conflict(self):
        a = self.record()
        a['identifiers']['doi'] = '10.1000/a'
        self.put(a)
        b = self.record('Another synthetic paper', '2304.13705')
        b['identifiers']['doi'] = '10.1000/b'
        self.put(b)
        bridge = copy.deepcopy(a)
        bridge['identifiers']['arxiv'] = '2304.13705'
        self.assertIn('multiple existing', self.put(bridge, update=True, ok=False)['error'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
