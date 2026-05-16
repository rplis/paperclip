# Free-preview demo page plan

Card: Build free-preview demo page using a public-domain sample EPUB
Owner: @developer
Status recommendation: Waiting for Supervisor

## Value hypothesis

If visitors can inspect a no-upload demo that shows original text, translated text, preserved chapter structure, and the final read/download experience, more visitors will trust the product enough to start a free preview with their own EPUB.

Target metric: upload or free-preview start rate from demo page visitors.
Baseline: unknown until analytics are available.
Success threshold: +10% relative lift in upload/free-preview starts from users who view the demo page, or at least 20 qualified CTA clicks in the first week after launch.
Measurement method: track demo page views, CTA clicks, upload starts, and free-preview starts with existing analytics or server events.

## Product context checked

Public search context for epubtoepub.com says the product already promises a free preview, reading-order EPUB translation, preserved chapters/flow, and final EPUB output rather than loose translated files. The demo page should therefore prove the same claims visually instead of introducing a new promise.

## Smallest useful implementation

1. Add a `/demo` or `/free-preview-demo` page linked from the homepage and blog CTAs.
2. Use a public-domain Project Gutenberg EPUB, preferably a short multilingual-friendly text with clear chapters.
3. Show a static, reviewable walkthrough:
   - source book metadata and public-domain attribution;
   - chapter list before and after translation;
   - side-by-side original and translated excerpt for one chapter;
   - preserved headings/paragraph structure;
   - read/download CTAs that point to the real upload/free-preview funnel.
4. Include a clear caveat that the demo is representative and users can upload their own EPUB for a private preview.
5. Add event hooks or documented tracking names for `demo_view`, `demo_cta_click`, and `demo_upload_start` if analytics exist.

## Copy-ready page outline

H1: See how an EPUB translation preview works

Primary CTA: Try a free preview with your EPUB

Sections:

- Sample book: public-domain source, original language, target language, and Project Gutenberg attribution.
- Chapter structure: show 3-5 source chapter headings beside matching translated headings.
- Side-by-side preview: one short excerpt with original text on the left and translated text on the right.
- Output proof: show that the translated result remains an EPUB with chapter navigation and a download/read path.
- CTA band: invite visitors to upload their own EPUB for a private free preview.

Suggested tracking names:

- `demo_page_view`
- `demo_primary_cta_click`
- `demo_secondary_upload_click`
- `demo_download_sample_click`

## Proposed sample source

Project Gutenberg is a safe default source for public-domain EPUBs. The implementation should use a book with an EPUB3 download and stable attribution. A candidate found during quick research:

- The Wept of Wish-Ton-Wish by James Fenimore Cooper
- Project Gutenberg page: https://www.gutenberg.org/ebooks/8888
- EPUB3: https://www.gutenberg.org/ebooks/8888.epub3.images

Before implementation, confirm the final chosen sample has a simple chapter structure and that the excerpt used is public domain in the target markets.

## Supervisor decision needed

Approve this lightweight demo-page approach before implementation. If approved, the next developer slice is to create the static page/content spec or patch the website code directly, depending on repository access.

## Risks

- If the page uses a long or obscure excerpt, it may fail to demonstrate translation quality quickly.
- If analytics are not wired, PM can only judge qualitative output and CTA placement.
- If the website code is not available in this workspace, the next deliverable should be a copy-ready implementation spec rather than a code patch.
