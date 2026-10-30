# Changelog

All notable changes are recorded here. Versions follow Semantic Versioning. Dates use Asia/Shanghai.

## [Unreleased]

### Changed

- Format core website, API, MCP, data-contract and export modules into readable source without changing their logic.
- Extract website reading and comparison handoff prompts into `lib/skill-prompts.ts` without changing their text.
- Document the website, MCP tools, Skill source and local-library mapping.

### Documentation

- Require each paper-reading delivery to collect the original and related analyses in a folder named after the paper, preserving library records and checking copied links.
- Add the hosted website entry and first-use steps for importing, reading, comparing, classifying and backing up papers.
- Document cloning, local database initialization, the browser address and local test login; clarify deployment requirements and the distinction between Skill and library backups.
- Add a website maintenance guide mapping features to source files, with GitHub synchronization, existing-site deployment and separate research-data backup instructions.

## [0.2.0] - 2026-10-22

### Added

- MIT license, third-party notices and contributor documentation.
- Complete portable `robotics-paper-workbench` Skill source, version 1.1.0.
- Reproducible Skill ZIP packaging and a sanitized public-source export.
- GitHub CI for TypeScript checks, website/Skill tests and production builds.
- Tag-triggered releases with version notes and the downloadable Skill ZIP.
- Releases created from the GitHub website can be completed by CI without duplicate-release failures.
- Repository instructions requiring future completed changes to be committed and synchronized to the configured GitHub repository.

## [0.1.0] - 2026-10-22

### Added

- Private robotics and embodied AI paper workspace with dashboard, library, reader, comparisons and taxonomy navigation.
- Paper links, local PDF uploads, PDF.js page rendering and text extraction.
- arXiv discovery, structured evidence-aware analysis, independent personal notes and multi-label classification.
- Codex MCP tools for reading papers, saving analyses and comparing related work.
- Portable library exports containing PDFs, Markdown, records and BibTeX.
