# Local Roboto TTFs (Optional)

`pdfRenderer.js` prefers TTFs bundled here for offline PDF export with full
Unicode rendering (Greek letters σφθβ, math operators ≤≥√, etc.). If no files
are present, the renderer falls back to fetching Roboto from cdnjs at runtime,
and finally to jsPDF's built-in Helvetica with ASCII sanitization (σ → "sigma").

## To enable offline PDF export with Unicode

Drop these three files into this directory (filenames must match exactly):

- `Roboto-Regular.ttf`
- `Roboto-Medium.ttf`
- `Roboto-Italic.ttf`

You can get them from any of:

- The official Roboto release: https://fonts.google.com/specimen/Roboto
- The pdfmake CDN mirror (same files PROFIS uses):
  - `https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.72/fonts/Roboto/Roboto-Regular.ttf`
  - `https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.72/fonts/Roboto/Roboto-Medium.ttf`
  - `https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.72/fonts/Roboto/Roboto-Italic.ttf`

The files are excluded from this README's directory in `.gitignore` patterns
only if your project chooses to (see project root `.gitignore`); by default
they will be committed and bundled with the build via Vite's asset pipeline.
