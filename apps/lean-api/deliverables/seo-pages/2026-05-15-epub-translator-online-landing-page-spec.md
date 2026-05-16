# EPUB Translator Online Landing Page Spec

Date: 2026-05-15
Target page: `/en/epub-translator-online`
Primary query: `EPUB translator online`
Secondary queries: `translate EPUB online`, `EPUB to EPUB translator`, `translate ebook online`, `ebook translator EPUB`

## Objective

Create a dedicated SEO and conversion page for users who want to upload an `.epub` file, preview a translation, and download a translated EPUB without manually extracting and rebuilding the ebook.

The page should drive one main action: start the upload flow.

## Verifiable Product Claims

Use only these proof points unless the product owner confirms more:

- EPUBtoEPUB accepts `.epub` files.
- The workflow is EPUB in, translated EPUB out.
- The service analyzes the EPUB and estimates translation length/price.
- Users can select a target language.
- Users can choose how images are handled.
- Users can generate a free preview before paying for the full translation.
- Payment happens after preview via Stripe.
- Users download the completed translated EPUB.
- The product is designed to preserve ebook structure such as chapters, navigation, formatting cues, links, images, metadata, and reading order where possible.

Avoid claims like "best", "instant", "100% accurate", "secure deletion after X days", "GDPR compliant", number of users, or guaranteed formatting preservation unless verified.

## SEO Metadata

Title:
`EPUB Translator Online | Translate EPUB to EPUB`

Meta description:
`Translate EPUB files online while keeping ebook structure. Upload an .epub, choose a target language, preview the translation for free, then download a translated EPUB.`

Canonical:
`https://epubtoepub.com/en/epub-translator-online`

Open Graph:
- `og:title`: `EPUB Translator Online`
- `og:description`: same as meta description
- `og:type`: `website`
- `og:url`: canonical URL

Indexing:
- Add to XML sitemap.
- Add an internal link from `/en`, `/en/blog`, and relevant blog articles using anchor text such as `EPUB translator online`.

## Page Structure

### Hero

H1:
`EPUB Translator Online`

Subheadline:
`Upload an .epub file, choose a target language, preview the translation for free, and download a translated EPUB without rebuilding the ebook by hand.`

Primary CTA:
`Upload EPUB`

CTA target:
Use the existing upload flow URL. If the app does not expose a separate upload URL, link to `/en` and scroll/focus the upload component.

Secondary CTA:
`See pricing`

Secondary target:
`/en/pricing`

Hero support bullets:
- `EPUB to EPUB workflow`
- `Free preview before payment`
- `Designed to keep chapters, navigation, and formatting cues intact`

### How It Works

H2:
`How the EPUB translation workflow works`

Steps:
1. `Upload your .epub file`
   Body: `The service reads the ebook structure and estimates the amount of text to translate.`
2. `Choose the target language`
   Body: `Select the language you want for the translated ebook and choose whether to keep images.`
3. `Generate a free preview`
   Body: `Review a translated sample before committing to the full job.`
4. `Pay only if the preview works for you`
   Body: `Continue through Stripe checkout when you are ready.`
5. `Download the translated EPUB`
   Body: `Get a rebuilt EPUB intended to remain usable in ebook readers.`

### Benefits

H2:
`Why use an EPUB-specific translator?`

Cards or compact rows:
- `Preserves ebook structure`
  `An EPUB contains chapters, navigation, links, metadata, images, CSS, and reading order. The workflow is built around the file format, not plain pasted text.`
- `Preview before you pay`
  `Check the translated sample for tone, formatting, names, special characters, and chapter flow first.`
- `No manual unpacking`
  `Avoid extracting chapter files, translating them one by one, and rebuilding the EPUB package manually.`
- `Built for full ebooks`
  `Use it for personal reading, study materials, reference books, guides, drafts, and other EPUB files where structure matters.`

### Supported Languages

H2:
`Supported languages`

Preferred implementation:
Render from the same source of truth the upload form uses for target-language options.

If that is not available:
Use copy that avoids a stale hardcoded list:
`Choose from the target languages available in the upload form. Common workflows include translating EPUB files into English and other major reading languages.`

Do not publish a hardcoded language list unless it is pulled from product configuration.

### Privacy

H2:
`Privacy and file handling`

Copy:
`Only upload EPUB files that you have the right to translate for your intended use. EPUBtoEPUB processes the file to create a translated preview and, if you continue, a full translated EPUB.`

If a real privacy policy URL exists, add:
`For details, read the Privacy Policy.`

Avoid making deletion, encryption, compliance, or human-access claims unless the privacy policy/product owner verifies them.

### Pricing / Free Preview

H2:
`Preview first, pay after`

Copy:
`EPUBtoEPUB estimates the translation from the uploaded EPUB and shows pricing before the full translation. You can generate a free preview, inspect the sample, and continue to payment only if the result looks right for your book.`

CTA:
`Upload EPUB for a free preview`

Link:
Existing upload flow.

### FAQ

H2:
`EPUB translator FAQ`

Questions and answers:

Q: `Can I translate an EPUB file online?`
A: `Yes. Upload an .epub file, choose the target language, generate a free preview, and continue to a full translated EPUB if the preview works for you.`

Q: `Will the translated EPUB keep my formatting?`
A: `The workflow is designed to preserve ebook structure such as chapters, navigation, headings, links, images, and formatting cues where possible. Translation length can still change line breaks and pagination depending on language and reader app.`

Q: `Is the preview free?`
A: `Yes. EPUBtoEPUB offers a free preview so you can inspect a translated sample before paying for the full translation.`

Q: `Can I translate an ebook into English?`
A: `Yes. Choose English as the target language during the upload workflow.`

Q: `Can I use Google Translate for an EPUB?`
A: `Google Translate can help with snippets of text, but a full EPUB also needs chapters, navigation, links, images, metadata, and packaging preserved. An EPUB-specific workflow is better when you need a translated ebook file back.`

Q: `What files are supported?`
A: `This page should position the product around .epub files. If users have another ebook format, they need a lawful usable EPUB version before uploading.`

## FAQ Schema

Add JSON-LD to the page using the same FAQ text above:

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
    },
    {
      "@type": "Question",
      "name": "Will the translated EPUB keep my formatting?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The workflow is designed to preserve ebook structure such as chapters, navigation, headings, links, images, and formatting cues where possible. Translation length can still change line breaks and pagination depending on language and reader app."
      }
    },
    {
      "@type": "Question",
      "name": "Is the preview free?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. EPUBtoEPUB offers a free preview so you can inspect a translated sample before paying for the full translation."
      }
    },
    {
      "@type": "Question",
      "name": "Can I translate an ebook into English?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Choose English as the target language during the upload workflow."
      }
    },
    {
      "@type": "Question",
      "name": "Can I use Google Translate for an EPUB?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Google Translate can help with snippets of text, but a full EPUB also needs chapters, navigation, links, images, metadata, and packaging preserved. An EPUB-specific workflow is better when you need a translated ebook file back."
      }
    },
    {
      "@type": "Question",
      "name": "What files are supported?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "This page is for .epub files. If users have another ebook format, they need a lawful usable EPUB version before uploading."
      }
    }
  ]
}
```

## UX Requirements

- Put the upload CTA above the fold on desktop and mobile.
- Repeat the upload CTA after How It Works, after Pricing/Preview, and after FAQ.
- Keep the page focused on one conversion path: upload EPUB.
- Do not bury the page under a generic blog layout.
- Use the same header/footer/navigation as the existing `/en` pages.
- On mobile, keep the primary CTA visible without forcing users to read the whole page first.

## Acceptance Criteria

- Page is available at `/en/epub-translator-online`.
- Page has exactly one H1 containing `EPUB Translator Online`.
- Primary CTA opens or focuses the existing upload flow.
- Pricing/free preview copy is present and accurate.
- Privacy copy avoids unverified guarantees.
- Supported languages are rendered from product config or described without a stale fixed list.
- FAQ is visible on-page and matching `FAQPage` JSON-LD is included.
- Canonical tag points to `https://epubtoepub.com/en/epub-translator-online`.
- Page is added to sitemap and internally linked from at least the homepage and one relevant blog/article page.
- No unverifiable social proof or performance claims are included.
