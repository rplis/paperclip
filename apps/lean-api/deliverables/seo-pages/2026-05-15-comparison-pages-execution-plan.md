# Comparison pages execution plan

Card: Publish the comparison pages
Date: 2026-05-15
Owner: @developer

## Evidence gathered

- `epubtoepub.com` is indexed with a live blog result for "Translate Ebook Files Without Turning Them Into a Formatting Puzzle" and a blog index.
- The indexed EPUBtoEPUB blog copy says the product parses the EPUB, translates in reading-order segments, uses glossary-style consistency, shows an upfront word-count price, provides a free preview, uses Stripe checkout, and returns a translated EPUB.
- Competitor SERP evidence shows two clusters:
  - Broad document translators: DeepL, Google Translate, FileIntact, VersQ, InOtherWord, PageTranslate.
  - EPUB/book-specific translators: ForgeFile, Doc2Lang, BookTranslator, OpenL, O.Translator, Polytext, WordwiseBook, EpubMagic.
- DeepL official documentation lists document translation support for `docx`, `doc`, `pptx`, `xlsx`, `pdf`, `htm/html`, `txt`, `xliff`, `srt`, and image files, but not EPUB.
- Several EPUB-specific competitors claim formatting, TOC, navigation, and EPUB output preservation, so EPUBtoEPUB comparison pages should not claim uniqueness unless verified. The safer angle is "EPUB-first workflow with preview and transparent checkout" rather than "only tool that preserves EPUB formatting."

## Proposed page set

1. `/en/compare/epubtoepub-vs-google-translate`
   - Search intent: users trying to translate an EPUB/book with a free generic translator.
   - Honest position: Google Translate is useful for snippets and quick understanding; EPUBtoEPUB is for producing a downloadable translated EPUB while keeping the ebook workflow intact.
   - Proof needed before publishing: whether Google Translate currently accepts EPUB directly, and exact behavior for pasted chapters vs uploaded documents.

2. `/en/compare/epubtoepub-vs-deepl`
   - Search intent: users who trust DeepL quality but need an ebook file, not only text or office/PDF document translation.
   - Honest position: DeepL is strong for supported document formats; EPUBtoEPUB is narrower and built around EPUB input, preview, pricing by word count, Stripe checkout, and EPUB output.
   - Verified support point: DeepL public API/docs list supported document types and do not list EPUB.

3. `/en/compare/epubtoepub-vs-booktranslator`
   - Search intent: direct EPUB/book translator comparison.
   - Honest position: compare workflow, output, pricing visibility, preview, privacy/deletion policy, supported formats, speed, and quality controls. Avoid winner language until each point is verified live.
   - Proof needed before publishing: BookTranslator current pricing, supported formats, preview behavior, privacy language, output file types.

4. `/en/compare/epubtoepub-vs-openl-epub-translator`
   - Search intent: users comparing EPUB-specific web tools.
   - Honest position: OpenL appears broad document-first with an EPUB page; EPUBtoEPUB can position as focused on EPUB-to-EPUB conversion, sample preview, and simple purchase flow if verified.
   - Proof needed before publishing: OpenL pricing, file limits, login requirements, preview behavior, and privacy language.

5. `/en/compare/epubtoepub-vs-otranslator`
   - Search intent: advanced EPUB layout users, especially Japanese/vertical text users.
   - Honest position: if O.Translator has stronger advanced layout claims, acknowledge that; EPUBtoEPUB should compete on focused EPUB workflow, preview-before-pay, simple UX, and transparent pricing where true.
   - Proof needed before publishing: O.Translator pricing, EPUB capabilities, vertical-text claims, output formats, and privacy terms.

## Reusable page structure

Each page should use the same structure to reduce production time and legal risk:

1. H1: `EPUBtoEPUB vs [Competitor]: which should you use for EPUB translation?`
2. Short answer box:
   - Choose `[Competitor]` if you need its strongest verified use case.
   - Choose EPUBtoEPUB if you need a translated EPUB output with a preview-first EPUB workflow.
3. Comparison table:
   - EPUB input
   - EPUB output
   - Formatting/TOC preservation
   - Free preview before payment
   - Upfront price
   - Privacy/deletion statement
   - Best for
4. Workflow comparison:
   - Upload/import
   - Preview/review
   - Pay/translate
   - Download/read
5. Quality caveats:
   - Machine translation may be unsuitable for publication without human review.
   - DRM-protected or copyrighted files require user permission.
   - Complex image text, footnotes, unusual CSS, and right-to-left/vertical layouts may need manual review unless verified.
6. CTA:
   - `Try a free EPUB preview`

## Draft positioning rules

- Use "EPUB-first" and "built for EPUB-to-EPUB output" instead of unverifiable "best" or "only."
- Do not claim superior privacy, speed, price, or quality until production policy/pricing and competitor facts are checked.
- For broad translators, the main contrast is file/workflow fit, not translation-model superiority.
- For EPUB-specific competitors, the main contrast is transparent workflow, preview-before-pay, and exact output expectations.

## Smallest execution slice after supervisor approval

Publish the first two broad-translator pages first:

1. EPUBtoEPUB vs Google Translate
2. EPUBtoEPUB vs DeepL

Reason: these have broad search demand, clearer honest contrast, and lower risk than direct claims against specialized EPUB competitors. After publishing, submit them to the sitemap/internal linking path from the blog and measure impressions/clicks before expanding to EPUB-specific competitor pages.

