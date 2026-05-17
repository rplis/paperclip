# Shareable before-after EPUB translation examples

Date: 2026-05-17
Owner: @pm
Website: `https://epubtoepub.com`
Card: Add shareable before-after translation examples

## Purpose

Create safe, compact examples that show the activation promise: an EPUB translation should keep book structure visible, not only translate loose paragraphs.

Use these examples in:

- Demo landing sections.
- Blog callouts.
- Reddit/forum comments where a concrete example is useful.
- Short social posts linking to the free preview upload flow.

Primary metric: upload CTA click rate on pages/posts that include the examples.
Secondary metric: upload starts after example views.
Success threshold: +10% relative improvement versus comparable pages/posts without examples.

## Product claims to keep

Safe claims:

- EPUB in, translated EPUB out.
- Chapter order, headings, navigation, reading order, and formatting cues are preserved where possible.
- The free preview lets a user inspect translation quality before paying.

Avoid:

- Perfect formatting.
- Guaranteed publication-ready translation.
- Copyright/legal advice.
- Claims that these are live production outputs unless generated through the app.

## Example 1: Alice, English to Spanish

Source:

- Book: `Alice's Adventures in Wonderland`
- Author: Lewis Carroll
- Source URL: `https://www.gutenberg.org/ebooks/11`
- Rights note: Project Gutenberg lists the work as public-domain in the United States. Confirm local rights before reuse outside the United States.

Shareable headline:

`What an EPUB translation preview should prove: not just translated text, but the same chapter structure.`

Before-after proof:

| EPUB element | Original | Spanish demo |
| --- | --- | --- |
| Chapter heading | `Down the Rabbit-Hole` | `Por la madriguera del conejo` |
| Next chapter | `The Pool of Tears` | `El charco de lagrimas` |
| Short excerpt | `no pictures or conversations` | `sin dibujos ni dialogos` |

Landing page caption:

`This public-domain EPUB example shows the trust signal readers need before uploading a whole book: the translated preview should still look like an ebook, with recognizable chapters and reading flow.`

Community post version:

`A useful test for any EPUB translator: after translation, can you still see the same chapter order and navigation? I put together a public-domain Alice example showing English -> Spanish text plus preserved chapter structure. The free preview flow is meant for this exact check before paying.`

CTA:

`Upload an EPUB and preview the translation`

Recommended link:

`https://epubtoepub.com/en?utm_source=community&utm_medium=example&utm_campaign=alice_before_after`

## Example 2: Don Quijote, Spanish to English

Source:

- Book: `Don Quijote`
- Author: Miguel de Cervantes Saavedra
- Source URL: `https://www.gutenberg.org/ebooks/2000`
- Rights note: Project Gutenberg lists the work as public-domain in the United States. Confirm local rights before reuse outside the United States.

Shareable headline:

`Long classic EPUBs are a structure test, not only a translation test.`

Before-after proof:

| EPUB element | Original | English demo |
| --- | --- | --- |
| Chapter label | `Capitulo primero` | `Chapter One` |
| Opening phrase | `En un lugar de la Mancha` | `In a village of La Mancha` |
| Character reference | `un hidalgo` | `a gentleman` |

Landing page caption:

`A long public-domain novel is useful because it makes structure problems obvious. The preview should let users inspect chapter labels, names, tone, and reading order before committing to a full translation.`

Community post version:

`For ebook translation, the question is not only "is this sentence translated?" It is also "does my EPUB still behave like an EPUB?" This Don Quijote example uses public-domain text to show a simple before/after with chapter labels preserved.`

CTA:

`Run a free EPUB preview`

Recommended link:

`https://epubtoepub.com/en?utm_source=community&utm_medium=example&utm_campaign=don_quijote_before_after`

## Example 3: Pride and Prejudice, English to Polish

Source:

- Book: `Pride and Prejudice`
- Author: Jane Austen
- Source URL: `https://www.gutenberg.org/ebooks/1342`
- Rights note: Project Gutenberg lists the work as public-domain in the United States. Confirm local rights before reuse outside the United States.

Shareable headline:

`Preview literary tone before translating a full EPUB.`

Before-after proof:

| EPUB element | Original | Polish demo |
| --- | --- | --- |
| Chapter label | `Chapter I` | `Rozdzial I` |
| Short phrase | `a single man` | `samotny mezczyzna` |
| Formatting cue | paragraph text remains paragraph text | tekst akapitu pozostaje akapitem |

Landing page caption:

`For literary books, a preview is especially important because tone and names matter. This public-domain example should be used to push visitors toward checking a sample before paying for the full EPUB.`

Community post version:

`For classics or study reading, I would not trust a full-book translator without a preview. This Pride and Prejudice example keeps the proof small: chapter label, short translated phrase, and paragraph structure.`

CTA:

`Preview your EPUB translation`

Recommended link:

`https://epubtoepub.com/en?utm_source=community&utm_medium=example&utm_campaign=pride_prejudice_before_after`

## Measurement instructions

Add tracking anywhere these examples are used:

- `before_after_example_view`
- `before_after_example_cta_click`
- `upload_start`

Suggested event properties:

- `example_book`
- `source_language`
- `target_language`
- `placement`
- `utm_campaign`

PM readout:

- Compare CTA click rate for pages with a visible before-after example against the same page template without the example, or against the nearest prior period if no clean A/B path exists.
- Treat traffic volume as directional until at least 100 example views or 20 CTA clicks, whichever comes first.
- If CTA click rate improves but upload starts do not, inspect whether the upload flow or language/price expectation is the bottleneck.

## Next implementation slice

Use the three examples as a reusable content block on:

1. `/en/demo/alice-in-wonderland-epub-translation`
2. `/en/demo/don-quijote-epub-translation`
3. The main `/en/epub-translator` landing page below the first CTA

No boss approval is needed for this safe slice because the sources are public-domain examples and the claims are conservative.
