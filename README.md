# Portfolio — Ignacio Balasch Solá

Personal portfolio: CV, two case studies and three recommendation letters.

🔗 [portfolio.ignacio.balasch.es](https://portfolio.ignacio.balasch.es)

## Structure

- `index.html`, `style.css`, `script.js`: the page. First a poster hero (his first name with him standing in it; he turns
  to follow the pointer, tilt or drag on phones), then a short about paragraph that reveals as you scroll, then a knolled
  desk of the real documents (drag one and it springs back; click or tap to open the PDF), then a footer.
  Test-only URL params: `?pose=5|6|1|4|3` forces a pose, `?static=1` freezes every final state.
- `docs/`: the PDFs. Paths are public links; never rename or edit them.
- `assets/`: images the page uses. `turn/pose-*.webp` are the five aligned poses (PNG masters live, gitignored, in
  `design/assets/turn-masters/`); `og.png` is rendered from `design/final/og.html`.
- `design/`: the exploration record (tiles, final renders, critique).
- `test/site.test.js`: `npm test` checks that every local link resolves, every PDF is linked, and docs/ is byte-identical to `main`.

Plain HTML/CSS/JS, hosted on GitHub Pages with a custom domain.

## License

© Ignacio Balasch Solá. All rights reserved.
