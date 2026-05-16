# Core SEO Landing Pages Execution Plan

Date: 2026-05-15
Owner: @developer
Card: Ship the core SEO landing pages

## Current evidence

- Public search results show EPUBtoEPUB has crawlable blog pages under `https://epubtoepub.com/en/blog` and `https://epubtoepub.com/en/blog/translate-ebook`.
- Indexed copy positions the product around uploading an EPUB, selecting a target language, seeing an estimate/free preview, paying via Stripe after preview, and downloading a translated EPUB.
- Existing local deliverables already cover:
  - `/en/epub-translator-online`
  - `/en/epub-translator`
  - `/en/translate-epub-to-english`
  - `/en/how-to-translate-epub-without-losing-formatting`
  - language-pair template work and several comparison-page concepts.
- The production website source/CMS is not present in this workspace, so the safest next execution unit is a frontend-ready page package that a site implementer can publish without inventing product claims.

## Proposed core page set

Create or improve seven high-intent pages, each with distinct intent to avoid cannibalization:

1. `/en/epub-translator`
   - Primary intent: broad tool query.
   - Primary query: `EPUB translator`.
   - Role: main evergreen product SEO page.

2. `/en/ai-ebook-translator`
   - Primary intent: AI ebook translation solution.
   - Primary query: `AI ebook translator`.
   - Role: explain machine translation workflow, preview-before-pay, and realistic quality caveats.

3. `/en/translate-epub-online`
   - Primary intent: task/action query.
   - Primary query: `translate EPUB online`.
   - Role: upload-focused page for users ready to translate now.

4. `/en/translate-epub-to-english`
   - Primary intent: target-language page.
   - Primary query: `translate EPUB to English`.
   - Role: English target-language landing page.

5. `/en/translate-epub-to-spanish`
   - Primary intent: target-language page.
   - Primary query: `translate EPUB to Spanish`.
   - Role: Spanish target-language landing page for language learners and personal reading.

6. `/en/translate-epub-to-polish`
   - Primary intent: target-language page.
   - Primary query: `translate EPUB to Polish`.
   - Role: Polish target-language landing page, with careful copy around personal reading and review.

7. `/en/translate-epub-without-losing-formatting`
   - Primary intent: risk-reduction query.
   - Primary query: `translate EPUB without losing formatting`.
   - Role: reassurance page for chapters, navigation, images, links, metadata, and reading order.

## Execution plan for Supervisor review

1. Consolidate existing specs into one publishable package with seven page briefs, route slugs, title tags, meta descriptions, H1s, hero copy, CTAs, page sections, internal links, and FAQ schema.
2. Reuse shared claims only where verified: EPUB input/output, target language selection, image handling, free preview, Stripe checkout after preview, and translated EPUB download.
3. Differentiate pages by search intent:
   - Tool page: product overview.
   - AI page: AI workflow and caveats.
   - Online page: immediate upload flow.
   - Language pages: target-language use cases.
   - Formatting page: structure preservation and QA checklist.
4. Add an internal linking map so the pages support each other and point users to `/en`, `/en/pricing`, `/en/blog/translate-ebook`, and the future page cluster.
5. Include acceptance criteria for implementation: indexable static content, canonical tags, sitemap entries, one H1, FAQ JSON-LD, visible FAQ, product screenshot/workflow image, and upload CTA above the fold.

## Risks and guardrails

- Avoid duplicate pages by giving each route a unique angle and title.
- Avoid unsupported claims such as guaranteed formatting preservation, human-level translation quality, GDPR/security guarantees, or current user counts.
- Do not hardcode supported-language lists unless the site can render them from product configuration.
- Do not publish competitor or comparative claims on these core pages unless separately verified.

## Smallest execution slice after approval

Produce `deliverables/seo-pages/2026-05-15-core-seo-landing-pages-publish-package.md` with the seven page briefs and implementation checklist, then close this card as a reviewable publishing package unless production repo/CMS access becomes available.
