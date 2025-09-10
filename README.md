# Takumi Playground

In‑browser playground for designing and rendering Open Graph style images using Takumi (WASM). Type JSX on the left, see a PNG/WEBP preview on the right, inspect logs, and download the result — all client‑side.

https://github.com/takumi-rs (packages used: `@takumi-rs/wasm`, `@takumi-rs/helpers`)


## Features

- Live editor: Monaco‑powered JSX editor with auto/ manual render and adjustable debounce
- PNG/WEBP output: Render via `@takumi-rs/wasm` and download as a data URL
- Tailwind‑like styling: Use `tw-to-css` (`twj()`) to turn utility strings into inline styles
- Image inlining: External `<img src>` URLs are fetched and embedded as Data URIs (CORS‑friendly)
- Debug panel: View transformed code, final JSX, image inlining stats, and errors
- Themes: Light/Dark UI toggle
- 100% client‑side: No server; everything runs in your browser


## Quickstart

### Prerequisites

- Bun (recommended) or Node.js 20+
- Modern browser with WebAssembly enabled

### Using Bun

```bash
bun install
bun run dev
```

Vite will print a local URL to open in your browser.

### Using Node.js

Scripts in `package.json` use Bun. If you prefer Node, run Vite directly:

```bash
npm install   # or pnpm/yarn
npx vite      # dev
npx vite build
npx vite preview
```


## Usage

1. Edit the JSX in the left panel. The default snippet shows Tailwind‑like styles via `twj()` and an external image.
2. Toggle Auto/Manual render and tweak the debounce delay as needed.
3. Switch output format between PNG/WEBP.
4. Download the rendered image.
5. Use the Debug Logs panel to inspect parsing/transform errors, inlined image counts, and final JSX.

Example snippet (same as the default):

```jsx
<div style={twj("h-full w-full flex items-start justify-start bg-white")}>
  <div style={twj("flex items-start justify-start h-full w-full relative")}>
    <img
      style={{ ...twj("absolute inset-0 w-full h-full"), ...{ objectFit: "cover" } }}
      src="https://picsum.photos/seed/picsum/1200/630"
    />
    <div
      style={{ ...twj("absolute inset-0 w-full h-full"), ...{ backgroundColor: "rgba(0,0,0,0.6)" } }}
    ></div>
    <div style={twj("flex items-center justify-center w-full h-full absolute inset-0")}>
      <div style={twj("text-[80px] text-white font-black text-center mx-20")}>
        Takumi Playground
      </div>
    </div>
  </div>
  {/* tip: PNG and WEBP are supported */}
</div>
```


## How It Works

The core flow lives in `src/components/Playground.tsx`:

1. Transform: `sucrase` compiles the editor’s JSX/TS to JS. Parse errors are surfaced with line/column info.
2. Evaluate: The compiled expression is evaluated into a React element with `React` and `twj` in scope.
3. Inline images: `inlineImageSources()` fetches external `<img src>` and replaces them with Data URIs to avoid cross‑origin issues.
4. Convert: `fromJsx` from `@takumi-rs/helpers/jsx` turns the React element tree into a Takumi node.
5. Render: `@takumi-rs/wasm` renders to PNG/WEBP. `useTakumi()` initializes the renderer and provides `renderAsDataUrl()`.

Fonts: On first run the hook fetches Inter Variable from jsDelivr for better text rendering. Rendering still works without it, but text may differ.


## Project Structure

```
src/
  components/Playground.tsx     # Main UI and render pipeline
  components/playground/*        # Header, editor, preview, logs
  hooks/useTakumi.ts             # WASM init, fonts, render helpers
  utils/                         # Image inlining, JSX debug, blob utils
  index.css, playground.css      # Styles
vite.config.ts                   # Vite + React
```


## Scripts

- `bun run dev`: Start Vite dev server
- `bun run build`: Build to `dist/`
- `bun run preview`: Preview the production build
- `bun run lint`: ESLint (`eslint.config.js`)

Node users can replace these with `npx vite`, `npx vite build`, etc.


## Notes & Limitations

- Security: The editor evaluates code client‑side. Do not paste untrusted code. This tool is for local development and experimentation.
- CORS & images: External images must be publicly fetchable; failures are logged and the renderer continues.
- Fonts: Inter loads from a CDN; offline first runs may render with fallback fonts.
- Browser support: Requires a modern browser with WebAssembly.


## Acknowledgements

- Takumi WASM renderer: `@takumi-rs/wasm`
- Helpers and JSX conversion: `@takumi-rs/helpers`
- Editor: `@monaco-editor/react`
- Styling utilities: `tw-to-css`
