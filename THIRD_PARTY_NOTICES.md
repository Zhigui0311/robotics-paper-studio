# Third-party software

The project’s original code is MIT licensed. Dependencies retain their own licenses; the lockfile identifies the distributed versions.

- **Sites starter and Vite helper:** MIT, OpenAI. Preserve `scripts/vite/sites-vite-plugin.LICENSE`.
- **shadcn UI components and vendored CSS:** MIT, shadcn. Preserve `vendor/shadcn-tailwind-4.13.0.LICENSE.md`.
- **PDF.js:** Apache-2.0, Mozilla and individual contributors. The build copies its root `LICENSE` to `public/pdf/LICENSE`.
- **PDF.js CMaps, fonts and WASM components:** preserve each component’s separate license. `public/pdf/cmaps/LICENSE`, the `LICENSE_*` files in `public/pdf/standard_fonts/`, and the `LICENSE_*` files in `public/pdf/wasm/` include Adobe/Foxit BSD-style terms, Liberation Fonts SIL OFL 1.1, MIT, OpenJPEG BSD and PDF.js Apache-2.0 notices. The asset preparation script copies these directories in full.
- **Portable reading Skill:** MIT. Its separate license is included in `skills/robotics-paper-workbench/LICENSE` and in the downloadable ZIP.

Publications, author code repositories and user-uploaded papers are not licensed by this project. No paper PDFs or personal knowledge base are included in the source distribution.
