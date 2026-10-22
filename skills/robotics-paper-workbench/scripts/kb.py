#!/usr/bin/env python3
"""Portable paper library: Python 3.9+ standard library, no network calls."""
import argparse
import contextlib
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import unicodedata
from urllib.parse import unquote, urlparse, parse_qs
import zipfile

SCHEMA = 1
DIMS = ('domain', 'task', 'method', 'embodiment', 'observation', 'action', 'validation', 'custom')
LEVELS = ('metadata', 'abstract', 'fulltext', 'fulltext+code')
STATES = ('queued', 'skimmed', 'analyzed')
DIRS = ('records', 'notes', 'attachments', 'comparisons', 'searches', 'history')
ID_PATTERN = r'[a-z0-9][a-z0-9-]{0,119}'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='microseconds')


def dump(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def local(root, name):
    require(isinstance(name, str) and name and '\\' not in name,
            'Local paths must be nonempty, portable relative paths.')
    rel = Path(name)
    require(not rel.is_absolute() and '..' not in rel.parts and not re.match(r'^[A-Za-z]:', name),
            'Path must stay inside the library: ' + name)
    path = root / rel
    require(path.resolve().is_relative_to(root.resolve()), 'Path escapes library: ' + name)
    return path


def atomic(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix='.' + path.name, dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as out:
            out.write(content)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


@contextlib.contextmanager
def writer(root):
    lock = local(root, '.write-lock')
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise ValueError('Library is locked. Wait for the writer; if it crashed, inspect .write-lock before removing it.')
    try:
        with os.fdopen(fd, 'w') as out:
            out.write(dump({'pid': os.getpid(), 'started_utc': now()}))
        yield
    finally:
        lock.unlink()


def canonical_ids(raw):
    require(isinstance(raw, dict), 'identifiers must be an object.')
    ids = {}
    for key in ('doi', 'arxiv', 'openreview'):
        value = raw.get(key)
        require(value is None or isinstance(value, str), key + ' must be a string or null.')
        if not value:
            ids[key] = None
            continue
        value = value.strip()
        if key == 'doi':
            value = unquote(re.sub(r'^(https?://(dx\.)?doi\.org/|doi:\s*)', '', value, flags=re.I)).lower()
            require(bool(re.fullmatch(r'10\.\d{4,9}/\S+', value)), 'Invalid DOI: ' + value)
        elif key == 'arxiv':
            value = re.sub(r'^(https?://(www\.)?arxiv\.org/(abs|pdf)/|arxiv:\s*)', '', value, flags=re.I)
            value = re.sub(r'\.pdf$', '', value)
            value = re.sub(r'v\d+$', '', value)
            require(bool(re.fullmatch(r'(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?/\d{7})', value)), 'Invalid arXiv ID: ' + value)
        elif value.startswith(('https://', 'http://')):
            parsed = urlparse(value)
            require(parsed.hostname in ('openreview.net', 'www.openreview.net'), 'Invalid OpenReview URL.')
            value = parse_qs(parsed.query).get('id', [''])[0]
            require(bool(value), 'OpenReview URL is missing id.')
        ids[key] = value
    return ids


def normalized_title(title):
    return ''.join(c for c in unicodedata.normalize('NFKC', title).casefold() if c.isalnum())


def source_location(root, value):
    require(isinstance(value, str) and bool(value), 'Source URL/path is required.')
    parsed = urlparse(value)
    if parsed.scheme:
        require(parsed.scheme in ('http', 'https') and bool(parsed.netloc), 'Only http(s) URLs or relative attachment paths are supported.')
    else:
        require(value.startswith('attachments/'), 'Local sources belong in attachments/.')
        require(local(root, value).is_file(), 'Missing local source: ' + value)


def validate(root, record, note_text=None):
    require(isinstance(record, dict), 'Record must be a JSON object.')
    require(type(record.get('schema_version')) is int and record['schema_version'] == SCHEMA, 'Unsupported record schema_version.')
    require(isinstance(record.get('title'), str) and record['title'].strip(), 'A verified title is required.')
    record['title'] = record['title'].strip()
    require(isinstance(record.get('authors'), list) and all(isinstance(x, str) and x.strip() for x in record['authors']), 'authors must be an array of names.')
    require(record.get('year') is None or (type(record['year']) is int and 1000 <= record['year'] <= 9999), 'year must be an integer or null.')
    require(record.get('venue') is None or isinstance(record['venue'], str), 'venue must be a string or null.')
    record['identifiers'] = canonical_ids(record.get('identifiers', {}))
    require(record.get('reading_status') in STATES, 'Invalid reading_status.')
    require(record.get('evidence_level') in LEVELS, 'Invalid evidence_level.')
    require(isinstance(record.get('summary', ''), str), 'summary must be a string.')
    require(isinstance(record.get('urls', {}), dict), 'urls must be an object.')
    for value in record.get('urls', {}).values():
        if value is not None:
            source_location(root, value)
    tags = record.get('tags', {})
    require(isinstance(tags, dict) and not set(tags).difference(DIMS), 'Unknown tag dimension; use tags.custom for project tags.')
    for dim in DIMS:
        values = tags.get(dim, [])
        require(isinstance(values, list) and all(isinstance(x, str) and x.strip() for x in values), 'Tags must be arrays of nonempty strings.')
        tags[dim] = sorted(set(x.strip() for x in values))
    record['tags'] = tags
    sources = record.get('sources')
    require(isinstance(sources, list) and sources, 'At least one verified source is required.')
    kinds = set()
    for source in sources:
        require(isinstance(source, dict), 'Each source must be an object.')
        source_location(root, source.get('url'))
        require(source.get('kind') in ('metadata', 'abstract', 'fulltext', 'code'), 'Invalid source kind.')
        require(isinstance(source.get('accessed'), str), 'Source accessed date is required (YYYY-MM-DD).')
        dt.date.fromisoformat(source['accessed'])
        kinds.add(source['kind'])
    level = record['evidence_level']
    require(level != 'abstract' or bool(kinds & {'abstract', 'fulltext'}), 'Abstract evidence requires an abstract/fulltext source.')
    require(not level.startswith('fulltext') or 'fulltext' in kinds, 'Full-text evidence requires a fulltext source.')
    require(level != 'fulltext+code' or 'code' in kinds, 'fulltext+code requires a code source.')
    require(record['reading_status'] != 'analyzed' or level.startswith('fulltext'), 'Analyzed status requires full-text evidence.')
    for name in ('results', 'relations', 'attachments'):
        require(isinstance(record.get(name, []), list), name + ' must be an array.')
    for result in record.get('results', []):
        require(isinstance(result, dict), 'Each result must be an object.')
        for key in ('task', 'metric', 'value', 'protocol', 'source', 'locator'):
            require(isinstance(result.get(key), str) and result[key].strip(), 'Result needs nonempty ' + key)
        source_location(root, result['source'])
    for relation in record.get('relations', []):
        require(isinstance(relation, dict), 'Each relation must be an object.')
        for key in ('target', 'kind', 'rationale'):
            require(isinstance(relation.get(key), str) and relation[key].strip(), 'Relation needs ' + key)
    for attachment in record.get('attachments', []):
        require(isinstance(attachment, str) and attachment.startswith('attachments/'), 'Attachment must be under attachments/.')
        require(local(root, attachment).is_file(), 'Missing attachment: ' + attachment)
    if 'id' in record:
        require(isinstance(record['id'], str) and bool(re.fullmatch(ID_PATTERN, record['id'])), 'Invalid record id.')
    if record.get('note_path'):
        require('id' in record and record['note_path'] == 'notes/' + record['id'] + '.md', 'note_path must be notes/<id>.md.')
        local(root, record['note_path'])
    if record['reading_status'] == 'analyzed':
        if note_text is None and record.get('note_path'):
            note = local(root, record['note_path'])
            if note.is_file():
                note_text = note.read_text(encoding='utf-8')
        require(isinstance(note_text, str) and bool(note_text.strip()), 'Analyzed status requires a saved reading note.')
    return record


def records(root):
    result = []
    for path in sorted(local(root, 'records').glob('*.json')):
        safe = local(root, path.relative_to(root).as_posix())
        record = validate(root, read_json(safe))
        require(record.get('id') == path.stem, 'Record id does not match filename: ' + path.name)
        if record.get('note_path'):
            require(local(root, record['note_path']).is_file(), 'Missing note: ' + record['note_path'])
        result.append(record)
    return result


def identity_matches(a, b):
    return any(v and v == b['identifiers'].get(k) for k, v in a['identifiers'].items())


def new_id(record):
    ids = record['identifiers']
    if ids['arxiv']:
        return 'arxiv-' + re.sub('[^a-z0-9]+', '-', ids['arxiv'].lower())
    key = ids['doi'] or ids['openreview'] or (normalized_title(record['title']) + str(record.get('year')))
    prefix = 'doi' if ids['doi'] else ('openreview' if ids['openreview'] else 'paper')
    return prefix + '-' + hashlib.sha256(key.encode()).hexdigest()[:16]


def md(value):
    return str(value).replace('\\', '\\\\').replace('|', '\\|').replace('[', '\\[').replace(']', '\\]').replace('\n', ' ')


def bib(value):
    mapping = {'\\': r'\textbackslash{}', '{': r'\{', '}': r'\}', '%': r'\%', '&': r'\&', '#': r'\#', '_': r'\_', '$': r'\$'}
    return ''.join(mapping.get(c, c) for c in str(value))


def reindex(root, items):
    lines = ['# 机器人论文知识库', '', '此页由 records/ 生成；请在 notes/ 中维护论文笔记。', '',
             '| 论文 | 年份 | 阅读状态 | 证据 |', '|---|---|---|---|']
    by_tag, entries = {}, []
    for r in sorted(items, key=lambda x: (-(x.get('year') or 0), x['title'])):
        target = r.get('note_path') or 'records/' + r['id'] + '.json'
        link = '[' + md(r['title']) + '](' + target + ')'
        lines.append('| {} | {} | {} | {} |'.format(link, r.get('year') or '未知', r['reading_status'], r['evidence_level']))
        for dim, tags in r['tags'].items():
            for tag in tags:
                by_tag.setdefault(dim + '/' + tag, []).append(link)
        fields = {'title': r['title']}
        if r['authors']:
            fields['author'] = ' and '.join(r['authors'])
        for key, value in (('year', r.get('year')), ('howpublished', r.get('venue')), ('doi', r['identifiers']['doi']), ('url', r.get('urls', {}).get('paper'))):
            if value:
                fields[key] = value
        if r['identifiers']['arxiv']:
            fields.update({'eprint': r['identifiers']['arxiv'], 'archivePrefix': 'arXiv'})
        entries.append('@misc{' + r['id'] + ',\n' + ',\n'.join('  ' + k + ' = {' + bib(v) + '}' for k, v in fields.items()) + '\n}')
    lines.extend(['', '## 分类索引', ''])
    for tag, links in sorted(by_tag.items()):
        lines.extend(['### ' + md(tag), ''] + ['- ' + link for link in links] + [''])
    atomic(local(root, 'index.md'), '\n'.join(lines) + '\n')
    atomic(local(root, 'bibliography.bib'), '\n\n'.join(entries) + ('\n' if entries else ''))


def add(root, args):
    incoming = read_json(Path(args.record))
    note = Path(args.note).read_text(encoding='utf-8') if args.note else None
    validate(root, incoming, note)
    items = records(root)
    matches = [r for r in items if r['id'] == incoming.get('id') or identity_matches(incoming, r)]
    require(len(matches) <= 1, 'Identifiers refer to multiple existing records; reconcile manually before importing.')
    existing = matches[0] if matches else None
    if existing:
        require(args.update, 'Already exists as ' + existing['id'] + '; read the record and note, then use --update with a complete revised record.')
        require(not incoming.get('id') or incoming['id'] == existing['id'], 'Use the existing stable id: ' + existing['id'])
        for key, value in existing['identifiers'].items():
            require(not (value and incoming['identifiers'][key] and value != incoming['identifiers'][key]), 'Conflicting identifier: ' + key)
            incoming['identifiers'][key] = incoming['identifiers'][key] or value
        require(LEVELS.index(incoming['evidence_level']) >= LEVELS.index(existing['evidence_level']), 'Evidence downgrade refused; inspect the record before a manual correction.')
        require(STATES.index(incoming['reading_status']) >= STATES.index(existing['reading_status']), 'Reading status downgrade refused; inspect the record before a manual correction.')
        incoming['id'] = existing['id']
        incoming['created_at'] = existing['created_at']
        if existing.get('note_path'):
            incoming['note_path'] = existing['note_path']
    else:
        require(not args.update, '--update requires an existing paper.')
        duplicates = [r['id'] for r in items if normalized_title(r['title']) == normalized_title(incoming['title']) and r.get('year') == incoming.get('year')]
        require(not duplicates, 'Possible title/year duplicate: ' + ', '.join(duplicates) + '. Verify identity and use its id with --update if it is the same paper.')
        incoming['id'] = incoming.get('id') or new_id(incoming)
        incoming['created_at'] = now()
    incoming['updated_at'] = now()
    if note is not None:
        require(bool(note.strip()), 'Reading note cannot be empty.')
        incoming['note_path'] = 'notes/' + incoming['id'] + '.md'
    validate(root, incoming, note)
    path = local(root, 'records/' + incoming['id'] + '.json')
    require(existing is not None or not path.exists(), 'ID collision; no files changed.')
    if existing is None and incoming.get('note_path'):
        require(not local(root, incoming['note_path']).exists(), 'An orphan note already uses this id; inspect it before importing.')
    if existing:
        stamp = re.sub('[^0-9]', '', now())
        atomic(local(root, 'history/' + incoming['id'] + '-' + stamp + '.json'), dump(existing))
        if note is not None and existing.get('note_path'):
            atomic(local(root, 'history/' + incoming['id'] + '-' + stamp + '.md'), local(root, existing['note_path']).read_text(encoding='utf-8'))
    if note is not None:
        atomic(local(root, incoming['note_path']), note)
    atomic(path, dump(incoming))
    reindex(root, [r for r in items if r['id'] != incoming['id']] + [incoming])
    return {'id': incoming['id'], 'updated': bool(existing), 'note_path': incoming.get('note_path')}


def tokens(text):
    text = unicodedata.normalize('NFKC', text).casefold()
    result = set(re.findall(r'[a-z0-9]+(?:-[a-z0-9]+)*', text))
    for word in re.findall(r'[\u3400-\u9fff]+', text):
        result.update(word[i:i + 2] for i in range(max(1, len(word) - 1)))
    return result


def text_of(root, r):
    content = dump(r)
    if r.get('note_path'):
        content += local(root, r['note_path']).read_text(encoding='utf-8')
    return content.casefold()


def brief(r, **extra):
    return dict(id=r['id'], title=r['title'], year=r.get('year'), reading_status=r['reading_status'],
                evidence_level=r['evidence_level'], tags=r['tags'], note_path=r.get('note_path'), **extra)


def retrieve(root, items, args):
    filters = []
    for raw in args.tag:
        require('=' in raw, '--tag must be dimension=value.')
        dim, value = raw.split('=', 1)
        require(dim in DIMS and value, 'Invalid tag filter.')
        filters.append((dim, value))
    query = args.query.casefold().split()
    ranked = []
    for r in items:
        if not all(v in r['tags'][d] for d, v in filters):
            continue
        text = text_of(root, r)
        hits = [q for q in query if q in text]
        if query and not hits:
            continue
        score = sum(3 if q in r['title'].casefold() else 1 for q in hits)
        ranked.append((score, r, hits))
    ranked.sort(key=lambda x: (-x[0], -(x[1].get('year') or 0), x[1]['id']))
    return [brief(r, score=s, matched_terms=h) for s, r, h in ranked[:args.limit]]


def similar(items, paper_id, limit):
    anchor = next((r for r in items if r['id'] == paper_id), None)
    require(anchor is not None, 'Unknown paper id: ' + paper_id)
    weights = {'task': 4, 'method': 3, 'action': 2, 'observation': 2, 'embodiment': 1, 'validation': 1, 'domain': 1, 'custom': 1}
    ranked = []
    for r in items:
        if r['id'] == paper_id:
            continue
        score, common = 0.0, {}
        for dim, weight in weights.items():
            a, b = set(anchor['tags'][dim]), set(r['tags'][dim])
            if a & b:
                common[dim] = sorted(a & b)
                score += weight * len(a & b) / len(a | b)
        a = tokens(anchor['title'] + ' ' + anchor.get('summary', ''))
        b = tokens(r['title'] + ' ' + r.get('summary', ''))
        overlap = sorted(a & b)
        if a | b:
            score += len(a & b) / len(a | b)
        if score:
            ranked.append((score, r, common, overlap))
    ranked.sort(key=lambda x: (-x[0], x[1]['id']))
    return [brief(r, score=round(s, 4), shared_tags=c, shared_terms=o, ranking='heuristic-candidate-only') for s, r, c, o in ranked[:limit]]


def audit(root, items):
    ids, keys, issues = set(), {}, []
    for r in items:
        ids.add(r['id'])
        for key, value in r['identifiers'].items():
            if value:
                marker = (key, value)
                if marker in keys:
                    issues.append('Duplicate identifier: ' + str(marker))
                keys[marker] = r['id']
    for r in items:
        for rel in r.get('relations', []):
            if rel['target'].startswith('local:') and rel['target'][6:] not in ids:
                issues.append('Unresolved local relation: ' + rel['target'])
    return {'ok': not issues, 'records': len(items), 'issues': issues,
            'note': 'Structural validation only; factual claims and citation support require source reading.'}


def export_library(root, output, items):
    report = audit(root, items)
    require(report['ok'], 'Resolve audit issues before export: ' + str(report['issues']))
    output = Path(output).expanduser().resolve()
    require(not output.is_relative_to(root.resolve()), 'Place the backup outside the library.')
    require(not output.exists(), 'Backup already exists; choose a new filename.')
    output.parent.mkdir(parents=True, exist_ok=True)
    paths = [local(root, x) for x in ('library.json', 'index.md', 'bibliography.bib')]
    for folder in DIRS:
        paths.extend(p for p in local(root, folder).rglob('*') if p.is_file())
    safe_paths = [local(root, p.relative_to(root).as_posix()) for p in paths]
    try:
        with zipfile.ZipFile(output, 'x', zipfile.ZIP_DEFLATED) as archive:
            for folder in DIRS:
                archive.writestr(root.name + '/' + folder + '/', '')
            for path in sorted(safe_paths):
                archive.write(path, Path(root.name) / path.relative_to(root))
    except Exception:
        if output.exists():
            output.unlink()
        raise
    return {'archive': str(output), 'files': len(safe_paths), 'records': len(items)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True, help='Library directory; data is separate from the skill.')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('init')
    p = sub.add_parser('add')
    p.add_argument('--record', required=True)
    p.add_argument('--note')
    p.add_argument('--update', action='store_true')
    for name in ('list', 'search'):
        p = sub.add_parser(name)
        p.add_argument('--query', default='')
        p.add_argument('--tag', action='append', default=[])
        p.add_argument('--limit', type=int, default=20)
    p = sub.add_parser('similar')
    p.add_argument('paper_id')
    p.add_argument('--limit', type=int, default=5)
    sub.add_parser('reindex')
    sub.add_parser('audit')
    p = sub.add_parser('export')
    p.add_argument('--out', required=True)
    args = parser.parse_args()
    try:
        root = Path(args.root).expanduser().resolve()
        require(not hasattr(args, 'limit') or args.limit > 0, '--limit must be positive.')
        if args.command == 'init':
            root.mkdir(parents=True, exist_ok=True)
            with writer(root):
                config = local(root, 'library.json')
                if config.exists():
                    require(read_json(config).get('schema_version') == SCHEMA, 'Unsupported library schema.')
                else:
                    require(not any((root / d).exists() for d in DIRS), 'Existing data found without library.json; inspect before initializing.')
                    atomic(config, dump({'schema_version': SCHEMA, 'language': 'zh-CN', 'created_at': now(), 'storage': 'relative-paths'}))
                for folder in DIRS:
                    local(root, folder).mkdir(exist_ok=True)
                reindex(root, records(root))
            result = {'root': str(root), 'initialized': True}
        else:
            require(local(root, 'library.json').is_file(), 'Library is not initialized; run init first.')
            require(read_json(local(root, 'library.json')).get('schema_version') == SCHEMA, 'Unsupported library schema.')
            for folder in DIRS:
                require(local(root, folder).is_dir(), 'Missing library directory: ' + folder + '; inspect the library before repairing with init.')
            with writer(root) if args.command in ('add', 'reindex', 'export') else contextlib.nullcontext():
                if args.command == 'add':
                    result = add(root, args)
                else:
                    items = records(root)
                    if args.command in ('search', 'list'):
                        result = retrieve(root, items, args)
                    elif args.command == 'similar':
                        result = similar(items, args.paper_id, args.limit)
                    elif args.command == 'audit':
                        result = audit(root, items)
                    elif args.command == 'reindex':
                        reindex(root, items)
                        result = {'indexed': len(items)}
                    else:
                        result = export_library(root, args.out, items)
        print(dump(result), end='')
        return 1 if isinstance(result, dict) and result.get('ok') is False else 0
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(dump({'error': str(error)}), file=sys.stderr, end='')
        return 2


if __name__ == '__main__':
    sys.exit(main())
