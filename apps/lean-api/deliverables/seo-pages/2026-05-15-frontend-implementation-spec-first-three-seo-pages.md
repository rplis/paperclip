# Frontend Implementation Spec: First Three High-Intent SEO Pages

Date: 2026-05-15
Owner: frontend developer
Requester: epub2epub-market
Primary domain: `https://epubtoepub.com`

## Objective

Publish three SEO landing pages that target high-intent EPUB translation searches and send visitors into the EPUB upload workflow.

The pages must be static/indexable, internally linked, include FAQ structured data, include product/workflow imagery, and use a clear CTA to translate an EPUB.

## Source Context

Use the existing EPUBtoEPUB positioning:

- EPUBtoEPUB translates EPUB files into translated EPUB files.
- Workflow: upload `.epub`, analyze word count, choose target language, choose image handling, generate a free preview, pay with Stripe if satisfied, download translated EPUB.
- Important value props: EPUB-aware structure preservation, chapters/navigation/images/metadata, upfront price, free preview before payment.
- Important caveat: automated translation is useful for personal reading, study, reference books, manuals, and draft review; final commercial/literary publication may still need human editing.

Public source pages checked:

- `https://epubtoepub.com/en/blog`
- `https://epubtoepub.com/en/blog/translate-ebook`

## Required Routes

Create and publish these routes:

1. `/en/translate-epub-to-english`
2. `/en/epub-translator`
3. `/en/how-to-translate-epub-without-losing-formatting`

Each route must:

- Return HTTP 200 without requiring JavaScript-only rendering for core content.
- Have a canonical URL matching the final production URL.
- Be included in sitemap generation if the site has a sitemap.
- Use language/locale metadata for English pages.
- Link to the upload workflow using the production upload URL. If no dedicated upload route exists, use `/en`.
- Link to pricing/upload-price step where possible. If no dedicated pricing route exists, link to `/en` with pricing-oriented link text.
- Include FAQ JSON-LD in the page head or body.

## Shared Page Layout

Use the existing EPUBtoEPUB site style. Do not create a marketing design that feels unrelated to the current app.

Recommended structure for each page:

1. SEO metadata
2. Hero section
   - H1
   - 1 short paragraph
   - Primary CTA button
   - Workflow/product image
3. Main content sections
4. Mid-page CTA
5. FAQ section visible on page
6. Final CTA
7. FAQ JSON-LD

Primary CTA target:

- Preferred: production upload route.
- Safe fallback: `/en`.

CTA button text should be action-oriented:

- `Upload your EPUB`
- `Preview an EPUB translation`
- `Translate your EPUB`

## Assets Required

Create or capture three images. Use actual product screenshots if possible. If screenshots are not available, create clean workflow images matching the product steps.

Asset paths:

1. `/images/seo/translate-epub-to-english-workflow.png`
2. `/images/seo/epub-translator-online-preview.png`
3. `/images/seo/epub-formatting-preservation-checklist.png`

Image requirements:

- Minimum desktop display width: 1200px source image preferred.
- Use compressed PNG or WebP depending on site conventions.
- Add explicit width/height or responsive aspect-ratio to avoid layout shift.
- Include descriptive `alt` text exactly or very close to the text listed in each page spec below.
- Do not show fake pricing unless it is clearly taken from the real app state.
- Do not show user-private uploaded content.

## Page 1: Translate EPUB to English

Route: `/en/translate-epub-to-english`

Search intent:

- Users want to translate a foreign-language EPUB into English.
- They are likely ready to upload a file if the page proves EPUB structure will be preserved.

SEO metadata:

- Meta title: `Translate EPUB to English Online | EPUBtoEPUB`
- Meta description: `Upload an EPUB, preview an English translation for free, and download a translated EPUB that keeps chapters, images, and ebook structure intact.`
- H1: `Translate EPUB to English`

Hero copy:

`Turn a foreign-language EPUB into a readable English EPUB without copying chapters by hand. EPUBtoEPUB reads the ebook structure, translates the text, and rebuilds a downloadable EPUB.`

Primary CTA:

- Text: `Upload your EPUB and preview the English translation`
- Target: production upload route, fallback `/en`

Image:

- Path: `/images/seo/translate-epub-to-english-workflow.png`
- Alt: `EPUBtoEPUB workflow showing upload, English target language, preview, payment, and translated EPUB download.`

Content sections:

### Why EPUB needs its own translation workflow

Explain that EPUB files include chapter HTML, navigation, internal links, CSS, metadata, cover art, and images. Generic text translation can translate words but does not rebuild a usable ebook.

### How EPUBtoEPUB translates an ebook into English

Use this ordered list:

1. Upload the `.epub` file.
2. Let the app estimate word count and price.
3. Choose English as the target language.
4. Choose whether to keep images.
5. Generate the free preview.
6. Review tone, names, formatting, and chapter flow.
7. Pay only if the preview is useful.
8. Download the translated English EPUB.

### Best-fit use cases

Use bullets:

- Personal reading.
- Study materials.
- Nonfiction books, manuals, and reference guides.
- Drafts that need an English reading copy before human editing.

Internal links:

- Upload link: `/en` or exact upload route.
- Pricing link text: `see the upfront price before payment`
- Related link: `/en/blog/translate-ebook`

FAQ visible content and JSON-LD:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Can I translate an EPUB to English online?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Upload an EPUB, choose English as the target language, preview the translated sample, and download the full translated EPUB after checkout."
      }
    },
    {
      "@type": "Question",
      "name": "Will the translated ebook still be an EPUB?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. EPUBtoEPUB is designed for EPUB in and EPUB out, so the result is a translated ebook file rather than pasted plain text."
      }
    },
    {
      "@type": "Question",
      "name": "Can I preview the English translation before paying?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. EPUBtoEPUB provides a free preview so you can check the translated sample, formatting, and reading flow before paying for the complete EPUB."
      }
    }
  ]
}
```

## Page 2: EPUB Translator Online

Route: `/en/epub-translator`

Search intent:

- Users are looking for a tool that translates EPUB files online.
- They need reassurance that the result remains an ebook, not plain translated text.

SEO metadata:

- Meta title: `EPUB Translator Online - Preview Before You Pay | EPUBtoEPUB`
- Meta description: `Translate EPUB ebooks online while preserving chapters, navigation, images, and structure. Upload an EPUB and preview the translation before checkout.`
- H1: `EPUB Translator Online`

Hero copy:

`Use an EPUB-aware translator for the whole ebook, not just copied paragraphs. EPUBtoEPUB parses the book, translates the readable text, and rebuilds a clean EPUB.`

Primary CTA:

- Text: `Start with a free EPUB translation preview`
- Target: production upload route, fallback `/en`

Image:

- Path: `/images/seo/epub-translator-online-preview.png`
- Alt: `EPUB translator interface showing EPUB upload, language selection, free preview, and final translated EPUB.`

Content sections:

### What an EPUB translator should preserve

Use bullets:

- Chapter order.
- Table of contents and internal links.
- Headings, paragraphs, emphasis, lists, and footnotes.
- Cover and embedded images when selected.
- Metadata and ebook readability.

### Why generic translators are risky for ebooks

Explain:

- Generic translators usually accept text, not the full EPUB package.
- Manual extraction can break links, images, navigation, or reading order.
- Long books need consistent terminology across segments.

### EPUBtoEPUB workflow

Describe the workflow in one compact section:

`Upload, analyze, choose language and image handling, preview, checkout, download.`

Position the free preview as the trust step before payment.

### Who this is for

Use bullets:

- Readers who want a personal translated copy.
- Students and researchers with study material.
- Authors testing how a draft reads in another language.
- Operators translating manuals or internal references.

Internal links:

- Upload link: `/en` or exact upload route.
- Pricing link text: `get an upfront word-count price`
- Related link: `/en/blog`

FAQ visible content and JSON-LD:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is an EPUB translator?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "An EPUB translator translates the text inside an EPUB ebook while preserving the surrounding ebook structure, such as chapters, navigation, images, and formatting."
      }
    },
    {
      "@type": "Question",
      "name": "Is EPUBtoEPUB different from copying text into a translator?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Copying text can translate excerpts, but it does not rebuild a usable EPUB. EPUBtoEPUB keeps the workflow focused on EPUB input and translated EPUB output."
      }
    },
    {
      "@type": "Question",
      "name": "Does EPUBtoEPUB keep images?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The workflow includes image handling, so users can choose how images should be treated before generating the translated ebook."
      }
    }
  ]
}
```

## Page 3: How to Translate an EPUB File Without Losing Formatting

Route: `/en/how-to-translate-epub-without-losing-formatting`

Search intent:

- Users are worried that translation will break EPUB formatting.
- The page should educate and then offer EPUBtoEPUB as the fastest safe workflow.

SEO metadata:

- Meta title: `How to Translate an EPUB Without Losing Formatting | EPUBtoEPUB`
- Meta description: `Learn the safe EPUB translation workflow: preserve chapters, navigation, images, and formatting while turning an ebook into a translated EPUB.`
- H1: `How to Translate an EPUB File Without Losing Formatting`

Hero copy:

`The safest EPUB translation workflow keeps the file as an ebook from upload to download. Avoid manual copy-paste, preserve structure, and check a translated preview first.`

Primary CTA:

- Text: `Translate your EPUB with a free preview`
- Target: production upload route, fallback `/en`

Image:

- Path: `/images/seo/epub-formatting-preservation-checklist.png`
- Alt: `Checklist for preserving EPUB chapters, navigation, images, metadata, and formatting during translation.`

Content sections:

### Why formatting breaks

Explain that EPUB is a package of structured files, not one plain-text document. Translating the wrong parts can damage HTML, CSS references, links, or navigation.

### The safe EPUB translation checklist

Use bullets:

- Start with a lawful `.epub` file.
- Keep the source as EPUB.
- Translate only readable text.
- Preserve chapters, links, images, metadata, and reading order.
- Rebuild a valid EPUB.
- Open the translated file in an ebook reader.

### Fast path with EPUBtoEPUB

Use this ordered list:

1. Upload.
2. Choose language and image handling.
3. Review price and preview.
4. Pay if the preview is acceptable.
5. Download the translated EPUB.

### When not to use automated EPUB translation

Use bullets:

- Final commercial literary publication without human editing.
- Files the user does not have rights to translate.
- Non-EPUB files that need conversion first.

Internal links:

- Upload link: `/en` or exact upload route.
- Pricing link text: `preview the translation before checkout`
- Related link: `/en/blog/translate-ebook`

FAQ visible content and JSON-LD:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I translate an EPUB without losing formatting?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Use an EPUB-aware workflow that parses the ebook, translates only readable text, preserves assets and navigation, and rebuilds a valid EPUB."
      }
    },
    {
      "@type": "Question",
      "name": "Can Google Translate translate a whole EPUB file?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Google Translate can help with snippets, but a whole EPUB also requires extraction, structure preservation, and rebuilding the ebook package."
      }
    },
    {
      "@type": "Question",
      "name": "Should I keep images in a translated EPUB?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "For most books, keeping images and the cover helps the translated EPUB remain useful and familiar. EPUBtoEPUB includes image handling in the translation workflow."
      }
    }
  ]
}
```

## Internal Linking Updates

After publishing the pages, add links to them from:

- `/en/blog`
- `/en/blog/translate-ebook`
- Any existing "ebook translator" or "translate ebook" blog pages
- Upload/home page if there is a suitable SEO/footer/resources area

Recommended anchor text:

- `translate EPUB to English`
- `EPUB translator online`
- `translate an EPUB without losing formatting`

Avoid stuffing all three links into every paragraph. Add them naturally in related guide/resource sections.

## Technical Acceptance Criteria

A frontend implementation is complete when:

- All three routes return HTTP 200.
- Each route has the correct title, meta description, H1, canonical URL, and indexable body content.
- Each route includes one product/workflow image with correct alt text.
- Each route has a primary CTA above the fold and another CTA near the end.
- CTAs link to the live upload flow or `/en` fallback.
- FAQ content appears visibly on the page.
- FAQ JSON-LD validates as `FAQPage`.
- Pages are internally linked from blog/resources surfaces.
- Sitemap includes all three routes, if the site uses a sitemap.
- No page contains placeholder copy such as `TODO`, fake screenshots, fake prices, or broken asset paths.
- Mobile layout has no horizontal scrolling and CTA text does not overflow.
- Lighthouse/SEO checks confirm that each page has title, meta description, crawlable links, image alt text, and canonical metadata.

## Post-Publish Checklist

1. Open each production URL and confirm content renders server-side or in crawlable static HTML.
2. Run Rich Results Test or Schema Markup Validator against each URL.
3. Check source HTML for one canonical tag per page.
4. Confirm all CTA and internal links work.
5. Confirm images load and are compressed.
6. Submit updated sitemap in Google Search Console.
7. Request indexing for the three new URLs.
8. Track impressions/clicks for these URLs in Search Console after publication.

## Implementation Notes

- If the site uses a framework with reusable SEO/page components, implement these pages with the same content model as existing blog or landing pages.
- If the site has MDX/content collections, these can be three content entries plus a shared landing-page template.
- If the site is app-only, still make these routes crawlable and avoid hiding the main text behind client-only state.
- Keep commercial claims restrained. Do not promise perfect formatting or publication-quality literary translation.
- Keep the CTA focused on the immediate conversion: upload an EPUB and preview translation.
