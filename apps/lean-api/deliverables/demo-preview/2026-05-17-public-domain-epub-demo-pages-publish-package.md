# Public-domain EPUB demo pages publish package

Date: 2026-05-17
Owner: @developer
Website: `https://epubtoepub.com`
Card: Add public-domain EPUB demo conversion pages

## Purpose

Create two crawlable demo pages that show concrete before/after EPUB translation examples and send visitors to the existing free preview upload flow.

Primary activation metric: visitor-to-upload-start rate from demo page visitors.
Success threshold: +15% upload-start rate from demo page visitors versus generic blog visitors.
Measurement method: compare analytics cohorts where landing page path starts with `/en/demo/` against `/en/blog/` visitors.

## Product context checked

Public indexed EPUBtoEPUB pages position the product around EPUB-aware translation: upload an EPUB, choose target language, generate a free preview, and receive a translated EPUB while preserving reading order, chapters, and ebook structure where possible.

Use careful wording:

- Say "preserves chapters, table of contents, reading order, and formatting cues where possible."
- Do not promise perfect translation, guaranteed formatting preservation, copyright clearance, or publication-ready output.
- Include a rights note: users should only upload books they have the right to translate for their intended use.

## Shared page requirements

Routes:

- `/en/demo/alice-in-wonderland-epub-translation`
- `/en/demo/don-quijote-epub-translation`

Each page should include:

- One visible H1.
- Self-referencing canonical URL.
- Public-domain source attribution with Project Gutenberg link.
- Side-by-side original and translated excerpt.
- Table of contents before/after proof.
- Supported target language module.
- Primary CTA to the existing upload/free-preview flow. If no dedicated upload path exists, use `/en`.
- Tracking events:
  - `demo_page_view`
  - `demo_primary_cta_click`
  - `demo_secondary_upload_click`
  - `demo_toc_expand`

Recommended CTA URL with UTM:

`/en?utm_source=demo_page&utm_medium=onsite&utm_campaign=public_domain_epub_demo`

## Page 1: Alice in Wonderland EPUB translation demo

Route: `/en/demo/alice-in-wonderland-epub-translation`

Meta title: `Alice in Wonderland EPUB Translation Demo | EPUBtoEPUB`

Meta description: `See a public-domain EPUB translation demo with before-and-after text, preserved chapter navigation, supported languages, and a free preview CTA.`

H1: `Alice in Wonderland EPUB translation demo`

Hero copy:

`See how a public-domain EPUB can move from original English text to a translated EPUB preview while keeping chapter order, headings, and ebook navigation visible.`

Primary CTA: `Try a free preview with your EPUB`

Source:

- Book: `Alice's Adventures in Wonderland`
- Author: Lewis Carroll
- Source: Project Gutenberg
- Source URL: `https://www.gutenberg.org/ebooks/11`
- Rights note: Public-domain source in the United States. Confirm local rights before reusing a full text outside the United States.

Demo settings:

- Original language: English
- Demo target language: Spanish
- Format: EPUB to translated EPUB
- Image handling: preserve images where possible

Table of contents proof:

| Original EPUB chapter | Translated EPUB chapter |
| --- | --- |
| Chapter I. Down the Rabbit-Hole | Capitulo I. Por la madriguera del conejo |
| Chapter II. The Pool of Tears | Capitulo II. El charco de lagrimas |
| Chapter III. A Caucus-Race and a Long Tale | Capitulo III. Una carrera de comite y un cuento largo |
| Chapter IV. The Rabbit Sends in a Little Bill | Capitulo IV. El conejo envia a un pequeño Bill |

Before/after excerpt:

| Original excerpt | Demo translation excerpt |
| --- | --- |
| Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do. | Alicia empezaba a cansarse mucho de estar sentada junto a su hermana en la orilla, sin tener nada que hacer. |
| Once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it. | Una o dos veces habia mirado de reojo el libro que leia su hermana, pero no tenia dibujos ni dialogos. |
| "And what is the use of a book," thought Alice, "without pictures or conversations?" | "¿Y para que sirve un libro", penso Alicia, "sin dibujos ni dialogos?" |

Suggested visual modules:

- Left panel: original EPUB excerpt.
- Right panel: translated EPUB excerpt.
- Middle proof strip: `.epub in` -> `free preview` -> `translated .epub out`.
- Compact TOC accordion showing chapter names are still navigable after translation.

CTA band:

`Want to test your own book instead of reading a sample? Upload an EPUB and generate a free translated preview from the start of the book.`

CTA label: `Start a free EPUB preview`

FAQ:

- `Is this demo translated from a real EPUB?`
  - `The sample uses public-domain text from Project Gutenberg and demonstrates the kind of before/after proof a translated EPUB preview should show.`
- `Will my translated EPUB keep the same chapters?`
  - `EPUBtoEPUB is designed around the EPUB package, so chapters, navigation, and reading order are preserved where possible.`
- `Can I choose a language other than Spanish?`
  - `Yes. Use the upload flow to choose the target language available for your book.`

## Page 2: Don Quijote EPUB translation demo

Route: `/en/demo/don-quijote-epub-translation`

Meta title: `Don Quijote EPUB Translation Demo | EPUBtoEPUB`

Meta description: `Review a Spanish-to-English public-domain EPUB translation demo with table of contents proof, before-and-after excerpts, and a free preview CTA.`

H1: `Don Quijote EPUB translation demo`

Hero copy:

`A classic public-domain Spanish EPUB is a good stress test for long chapters, older prose, names, headings, and ebook navigation. This demo shows the kind of evidence to check before translating your own EPUB.`

Primary CTA: `Preview your EPUB translation`

Source:

- Book: `Don Quijote`
- Author: Miguel de Cervantes Saavedra
- Source: Project Gutenberg
- Source URL: `https://www.gutenberg.org/ebooks/2000`
- Rights note: Public-domain source in the United States. Confirm local rights before reusing a full text outside the United States.

Demo settings:

- Original language: Spanish
- Demo target language: English
- Format: EPUB to translated EPUB
- Image handling: preserve images where possible

Table of contents proof:

| Original EPUB chapter | Translated EPUB chapter |
| --- | --- |
| Capitulo primero | Chapter One |
| Que trata de la condicion y ejercicio del famoso hidalgo | Which treats of the condition and occupation of the famous gentleman |
| Capitulo II | Chapter II |
| Que trata de la primera salida que de su tierra hizo el ingenioso don Quijote | Which treats of the first sally the ingenious Don Quixote made from his home |

Before/after excerpt:

| Original excerpt | Demo translation excerpt |
| --- | --- |
| En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivia un hidalgo. | In a village of La Mancha, whose name I do not wish to remember, not long ago there lived a gentleman. |
| Frisaba la edad de nuestro hidalgo con los cincuenta anos. | Our gentleman was close to fifty years old. |
| Tenia en su casa una ama que pasaba de los cuarenta, y una sobrina que no llegaba a los veinte. | In his house he had a housekeeper past forty and a niece not yet twenty. |

Suggested visual modules:

- Before/after excerpt with language labels.
- TOC preservation panel for long-book trust.
- "Best for" row: public-domain classics, study reading, personal research, language learning.
- Rights reminder before the CTA.

CTA band:

`Use the free preview to check tone, names, chapter flow, and formatting before you pay for a full translation.`

CTA label: `Run a free preview`

FAQ:

- `Why use a public-domain book for this demo?`
  - `Public-domain books can be shown publicly without using a customer's private file.`
- `Does EPUBtoEPUB translate the whole book at once?`
  - `The product parses the EPUB in reading order and creates a preview first, so you can inspect a sample before continuing.`
- `Will older language translate perfectly?`
  - `Automated translation can need human review for literary tone. Use the preview to decide whether the output is good enough for your use case.`

## Supported-language module

Use this module on both demo pages. Keep the copy generic unless the production app exposes a definitive language list.

Heading: `Try the same EPUB workflow in your target language`

Copy:

`EPUBtoEPUB is built for whole-book translation workflows. Upload your EPUB, choose the target language available in the app, generate a free preview, and check the result before payment.`

Visible language examples:

- English
- Spanish
- Polish
- French
- German
- Italian
- Portuguese
- Ukrainian

Safety line:

`Language availability can change. The upload flow is the source of truth for currently supported targets.`

## Implementation notes

If the production repo supports content collections, these pages can be shipped as two static content entries using the same reusable `DemoEpubPage` component:

- Props: `slug`, `sourceBook`, `sourceUrl`, `originalLanguage`, `targetLanguage`, `tocRows`, `excerptRows`, `ctaUrl`.
- Add `/en/demo` pages to sitemap.
- Link to these demos from `/en/blog/translate-ebook`, `/en/epub-translator`, and the homepage upload section.

If no design component exists yet, ship simple static sections first. The activation value comes from proof and CTA clarity, not complex UI.

## Analytics cohort recommendation

Segment demo traffic by:

- Landing path begins with `/en/demo/`
- CTA event: `demo_primary_cta_click`
- Upload-start event after CTA in the same session

PM comparison:

- Demo cohort: `/en/demo/*`
- Baseline cohort: `/en/blog/*`
- Success: demo cohort upload-start rate is at least 15% higher than generic blog visitor upload-start rate over the first meaningful sample window.

## Remaining dependency

The live website code is not present in this workspace, so this package is ready for implementation handoff rather than directly deployed. No boss decision is needed for this safe slice because both examples use public-domain Project Gutenberg sources and conservative product claims.
