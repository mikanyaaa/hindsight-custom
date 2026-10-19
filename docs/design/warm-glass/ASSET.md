# Warm glass backdrop provenance

- Origin: original artwork generated specifically for this repository.
- Tool: OpenAI image generation (`image_gen.imagegen`).
- Generation date: 2026-10-18 (UTC).
- Asset: `hindsight-control-plane/src/custom/theme/assets/lofi-city.webp`.
- Encoding: 1440 × 810, WebP quality 74, 177,520 bytes; encoded with the existing Sharp dependency.
- The illustration contains no copyrighted characters, logos or IP from existing anime or games. It depicts a fictional coastal city, without recognizable branded elements.
- No third-party artwork was supplied to generation. The old PR #6 asset was replaced because its exact prompt was not recoverable.

## Exact prompt

> Create an original wide 16:9 background illustration for a frosted-glass productivity dashboard. A peaceful fictional coastal city in a bright lo-fi anime-inspired illustration style, viewed from a hillside terrace over compact pastel buildings toward a blue sea. Golden-hour peach sunlight, lavender shadows, pale turquoise sky, soft cream clouds, muted coral rooftops, small green plants, atmospheric depth, painterly grain, calm welcoming mood. Bright but gently desaturated colors. Broad quiet areas behind interface panels, interesting architecture toward the edges. No people, no characters, no text, no logos, no recognizable landmarks, and no intellectual property from existing anime or games. Full-bleed landscape artwork only, no interface, no border.

## Delivery and governance

The asset is local, fingerprinted by Next.js, and imported after the opted-in theme
mounts and the browser becomes idle (a timer fallback is provided). Its URL is not
in critical CSS. No remote image host, runtime image-generation request, CSP change,
or new dependency is introduced. Future replacements must record their provenance,
exact prompt or license, dimensions, compressed size, and visual IP review here.
Keep screenshots outside the code branch; this file documents the product asset,
not screenshot evidence.
