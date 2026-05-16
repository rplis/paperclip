# Core SEO Landing Pages Publish Package

Date: 2026-05-15
Owner: @developer
Website: `https://epubtoepub.com`

## Source Evidence

Public indexed EPUBtoEPUB pages checked:

- `https://epubtoepub.com/en/blog`
- `https://epubtoepub.com/en/blog/translate-ebook`

Use only these verified product claims:

- EPUBtoEPUB accepts `.epub` files.
- The workflow is EPUB in, translated EPUB out.
- Users upload an EPUB, select a target language, choose image handling, generate a free preview, pay through Stripe after preview, and download the completed translated EPUB.
- The product is designed to preserve ebook structure such as chapters, navigation, formatting cues, links, images, metadata, and reading order where possible.
- Translation length can shift line breaks and pagination, and automated output may still need human review for publication-quality work.

Avoid unsupported claims such as guaranteed formatting preservation, instant completion, perfect accuracy, security/compliance promises, user counts, or "best" language.

## Shared Implementation Requirements

Each page should be static or server-rendered enough that the primary content is crawlable without relying on client-only rendering.

For every route:

- Return HTTP 200.
- Set a self-referencing canonical URL.
- Use one visible H1.
- Include a visible FAQ section and matching FAQ JSON-LD.
- Add the page to the XML sitemap.
- Link the primary CTA to the upload flow. If no dedicated upload URL exists, use `/en`.
- Include a workflow/product image or screenshot with explicit width/height or aspect-ratio.
- Internally link to `/en`, `/en/blog`, `/en/blog/translate-ebook`, and adjacent landing pages where contextually relevant.

Recommended shared CTA labels:

- `Upload your EPUB`
- `Preview an EPUB translation`
- `Translate your EPUB`

## Internal Linking Map

Hub page:

- `/en/epub-translator` should link to all six supporting pages.

Supporting pages:

- Each language page should link back to `/en/epub-translator` and `/en/translate-epub-online`.
- `/en/ai-ebook-translator` should link to `/en/translate-epub-without-losing-formatting` and `/en/translate-epub-online`.
- `/en/translate-epub-without-losing-formatting` should link to `/en/epub-translator`, `/en/translate-epub-online`, and `/en/blog/translate-ebook`.

Suggested anchors:

- `EPUB translator`
- `AI ebook translator`
- `translate EPUB online`
- `translate EPUB to English`
- `translate EPUB to Spanish`
- `translate EPUB to Polish`
- `translate an EPUB without losing formatting`

## Page 1: EPUB Translator

Route: `/en/epub-translator`

Primary query: `EPUB translator`

Search intent: The user wants a tool that translates a full EPUB file and returns a usable ebook, not pasted text.

Meta title: `EPUB Translator Online - Preview Before You Pay | EPUBtoEPUB`

Meta description: `Translate EPUB ebooks online while preserving chapters, navigation, images, and structure where possible. Upload an EPUB and preview the translation before checkout.`

H1: `EPUB Translator Online`

Hero copy: `Use an EPUB-aware translator for the whole ebook, not just copied paragraphs. EPUBtoEPUB parses the book, translates the readable text, and rebuilds a downloadable EPUB.`

Primary CTA: `Start with a free EPUB translation preview`

Sections:

1. `What an EPUB translator should preserve`
   - Chapter order.
   - Table of contents and internal links.
   - Headings, paragraphs, emphasis, lists, and footnotes.
   - Cover and embedded images when selected.
   - Metadata and ebook readability.
2. `Why generic translators are risky for ebooks`
   - Generic translators usually accept text, not the full EPUB package.
   - Manual extraction can break links, images, navigation, or reading order.
   - Long books need consistent terminology across segments.
3. `How EPUBtoEPUB works`
   - Upload, analyze, choose language and image handling, preview, checkout, download.
4. `Who this is for`
   - Personal reading.
   - Study materials and research.
   - Manuals, guides, and reference books.
   - Draft review before human editing.

Image: `/images/seo/epub-translator-online-preview.png`

Alt text: `EPUB translator interface showing EPUB upload, language selection, free preview, and final translated EPUB.`

FAQ:

- `What is an EPUB translator?`
- `Is EPUBtoEPUB different from copying text into a translator?`
- `Does EPUBtoEPUB keep images?`
- `Can I preview the translation before paying?`

## Page 2: AI Ebook Translator

Route: `/en/ai-ebook-translator`

Primary query: `AI ebook translator`

Search intent: The user is comparing AI translation tools and needs an honest explanation of automated ebook translation.

Meta title: `AI Ebook Translator for EPUB Files | EPUBtoEPUB`

Meta description: `Use AI to translate EPUB ebooks while keeping the file as an EPUB. Upload a book, preview the translation for free, then download a translated EPUB.`

H1: `AI Ebook Translator for EPUB Files`

Hero copy: `Translate an ebook with an AI workflow built around EPUB structure. EPUBtoEPUB handles the book as chapters, navigation, assets, and readable text, then rebuilds a translated EPUB.`

Primary CTA: `Preview an AI ebook translation`

Sections:

1. `AI translation is only part of ebook translation`
   - The page should explain that a book also includes structure, assets, navigation, metadata, and packaging.
2. `The EPUBtoEPUB AI workflow`
   - Upload the EPUB.
   - Analyze text length.
   - Choose target language and image handling.
   - Generate a free preview.
   - Review quality before payment.
   - Download the translated EPUB.
3. `Where AI ebook translation works well`
   - Personal reading.
   - Study and research.
   - Internal manuals and reference material.
   - Draft review.
4. `When to add human review`
   - Literary publishing.
   - Legal, medical, academic, or commercial text where precision matters.
   - Brand-sensitive localization.

Image: `/images/seo/ai-ebook-translator-workflow.png`

Alt text: `AI ebook translation workflow showing EPUB analysis, target language selection, preview, checkout, and translated EPUB download.`

FAQ:

- `Can AI translate a whole ebook?`
- `Will the output still be an EPUB file?`
- `Should I use human review after AI ebook translation?`
- `Can I check the AI translation before paying?`

## Page 3: Translate EPUB Online

Route: `/en/translate-epub-online`

Primary query: `translate EPUB online`

Search intent: The user wants a direct upload path and practical steps.

Meta title: `Translate EPUB Online | Upload, Preview, Download`

Meta description: `Translate an EPUB online without rebuilding the ebook by hand. Upload an .epub, choose a language, preview the translation, and download a translated EPUB.`

H1: `Translate EPUB Online`

Hero copy: `Upload your EPUB, choose the language you want, preview the translated sample, and continue only if the result works for your book.`

Primary CTA: `Upload your EPUB`

Sections:

1. `How to translate an EPUB online`
   - Upload `.epub`.
   - Select target language.
   - Choose image handling.
   - Generate the free preview.
   - Review the sample.
   - Pay if satisfied.
   - Download the translated EPUB.
2. `Why online EPUB translation needs structure`
   - EPUB is a package of chapters, CSS, images, links, and metadata.
3. `Preview before payment`
   - Position preview as the quality check for wording, tone, formatting cues, names, and chapter flow.
4. `Before you upload`
   - Confirm the file is EPUB.
   - Confirm you have the right to translate it for your intended use.
   - Decide whether images should be kept.

Image: `/images/seo/translate-epub-online-upload-preview.png`

Alt text: `Online EPUB translation steps from upload through preview and translated EPUB download.`

FAQ:

- `Can I translate an EPUB file online?`
- `Do I need to copy chapters manually?`
- `Is the preview free?`
- `What file type should I upload?`

## Page 4: Translate EPUB to English

Route: `/en/translate-epub-to-english`

Primary query: `translate EPUB to English`

Search intent: The user has a foreign-language EPUB and wants an English reading copy.

Meta title: `Translate EPUB to English Online | EPUBtoEPUB`

Meta description: `Upload an EPUB, preview an English translation for free, and download a translated EPUB that keeps chapters, images, and ebook structure where possible.`

H1: `Translate EPUB to English`

Hero copy: `Turn a foreign-language EPUB into a readable English EPUB without copying chapters by hand. EPUBtoEPUB reads the ebook structure, translates the text, and rebuilds a downloadable EPUB.`

Primary CTA: `Upload your EPUB and preview the English translation`

Sections:

1. `Why EPUB needs its own translation workflow`
2. `How EPUBtoEPUB translates an ebook into English`
3. `Best-fit English translation use cases`
4. `What to review in the preview`

Image: `/images/seo/translate-epub-to-english-workflow.png`

Alt text: `EPUBtoEPUB workflow showing upload, English target language, preview, payment, and translated EPUB download.`

FAQ:

- `Can I translate an EPUB to English online?`
- `Will the translated ebook still be an EPUB?`
- `Can I preview the English translation before paying?`
- `What kinds of books are a good fit?`

## Page 5: Translate EPUB to Spanish

Route: `/en/translate-epub-to-spanish`

Primary query: `translate EPUB to Spanish`

Search intent: The user wants a Spanish EPUB for reading, study, or draft review.

Meta title: `Translate EPUB to Spanish Online | EPUBtoEPUB`

Meta description: `Translate an EPUB to Spanish online. Upload your ebook, preview the Spanish translation, and download a translated EPUB after checkout.`

H1: `Translate EPUB to Spanish`

Hero copy: `Create a Spanish reading copy from an EPUB while keeping the workflow focused on the ebook file, not copied text fragments.`

Primary CTA: `Preview a Spanish EPUB translation`

Sections:

1. `A Spanish translation should still feel like an ebook`
   - Chapters, table of contents, links, images, and formatting cues matter.
2. `How the Spanish EPUB workflow works`
   - Upload, choose Spanish, choose image handling, preview, checkout, download.
3. `Common use cases`
   - Language learning.
   - Personal reading.
   - Study material.
   - Draft review before Spanish editing.
4. `What to check in the preview`
   - Names, terminology, accents, punctuation, headings, and chapter flow.

Image: `/images/seo/translate-epub-to-spanish-workflow.png`

Alt text: `Workflow for translating an EPUB to Spanish with preview and translated EPUB download.`

FAQ:

- `Can I translate an EPUB to Spanish online?`
- `Can I preview the Spanish translation first?`
- `Will accents and Spanish punctuation display correctly?`
- `Is this suitable for final publication?`

## Page 6: Translate EPUB to Polish

Route: `/en/translate-epub-to-polish`

Primary query: `translate EPUB to Polish`

Search intent: The user wants a Polish EPUB output and likely needs confidence around Polish characters and ebook structure.

Meta title: `Translate EPUB to Polish Online | EPUBtoEPUB`

Meta description: `Translate EPUB files to Polish online. Upload an ebook, preview the Polish translation, and download a translated EPUB while preserving structure where possible.`

H1: `Translate EPUB to Polish`

Hero copy: `Translate an EPUB into Polish and keep the result as an EPUB. Preview the Polish sample before deciding whether to run the full ebook translation.`

Primary CTA: `Preview a Polish EPUB translation`

Sections:

1. `Polish EPUB translation needs both language and structure`
   - Polish characters, paragraph flow, headings, and navigation need to remain readable in ebook readers.
2. `How the Polish EPUB workflow works`
   - Upload, choose Polish, choose image handling, preview, checkout, download.
3. `Good fits for Polish EPUB translation`
   - Personal reading.
   - Study and reference material.
   - Manuals and guides.
   - Draft review before human editing.
4. `What to review before payment`
   - Polish diacritics, names, terminology, headings, formatting cues, and reading flow.

Image: `/images/seo/translate-epub-to-polish-workflow.png`

Alt text: `Workflow for translating an EPUB to Polish with language selection, preview, checkout, and EPUB download.`

FAQ:

- `Can I translate an EPUB to Polish online?`
- `Will Polish characters work in the translated EPUB?`
- `Can I check the Polish translation before paying?`
- `Should I use human editing for publishing?`

## Page 7: Translate EPUB Without Losing Formatting

Route: `/en/translate-epub-without-losing-formatting`

Primary query: `translate EPUB without losing formatting`

Search intent: The user is worried about broken layout, navigation, links, images, or ebook packaging.

Meta title: `Translate EPUB Without Losing Formatting | EPUBtoEPUB`

Meta description: `Learn how to translate an EPUB while preserving chapters, navigation, images, links, and formatting cues where possible. Preview before paying.`

H1: `Translate EPUB Without Losing Formatting`

Hero copy: `The safest EPUB translation workflow keeps the file as an ebook from upload to download. Preserve structure where possible, avoid manual copy-paste, and check a translated preview first.`

Primary CTA: `Translate your EPUB with a free preview`

Sections:

1. `Why EPUB formatting breaks`
   - EPUB is structured HTML, CSS, assets, metadata, navigation, and reading order.
2. `What a careful EPUB workflow preserves`
   - Chapters, table of contents, internal links, images, cover art, headings, paragraphs, lists, emphasis, metadata, and reading order.
3. `The EPUBtoEPUB path`
   - Upload, choose language and image handling, preview, pay if useful, download.
4. `Honest caveat`
   - Translation length varies by language; line breaks and pagination can shift by reader app.
5. `Post-download QA checklist`
   - Open in an ebook reader.
   - Check table of contents.
   - Spot-check chapters.
   - Verify images and links where they matter.

Image: `/images/seo/epub-formatting-preservation-checklist.png`

Alt text: `Checklist for preserving EPUB chapters, navigation, images, metadata, and formatting during translation.`

FAQ:

- `How do I translate an EPUB without losing formatting?`
- `Can Google Translate translate a whole EPUB file?`
- `Will pagination stay exactly the same?`
- `Should I keep images in a translated EPUB?`

## FAQ JSON-LD Template

Use the same visible FAQ text on the page and in JSON-LD. Example shape:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Can I translate an EPUB file online?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Upload an .epub file, choose the target language, generate a free preview, and continue to a full translated EPUB if the preview works for you."
      }
    }
  ]
}
```

## Publishing Checklist

Before marking implementation complete:

- Confirm all seven routes return 200.
- Confirm canonical tags match production URLs.
- Confirm every route is in the sitemap.
- Confirm each page has one H1 and distinct title/meta description.
- Confirm the FAQ JSON-LD validates and matches visible FAQ content.
- Confirm upload CTAs point to the live upload flow.
- Confirm no page promises guaranteed formatting, perfect translation, instant results, or unverified privacy/security claims.
- Confirm each page links to the hub page and at least two related pages.
- Confirm pages are not thin duplicates; each has a distinct angle matching its query intent.
