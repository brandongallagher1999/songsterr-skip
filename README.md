# songsterr-skip

Tampermonkey userscript that dismisses Songsterr’s “continue” / paywall overlays, auto-resumes playback, and keeps the playhead visible when ads get stuck.

## Setup

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser (Chrome, Firefox, Edge, Safari, etc.).
2. Open the Tampermonkey dashboard → **Create a new script**.
3. Replace the default template with the contents of [`script.js`](./script.js).
4. Save the script (Ctrl/Cmd+S).
5. Visit [songsterr.com](https://www.songsterr.com/) — the script runs automatically on `https://www.songsterr.com/*`.

Make sure Tampermonkey is enabled for the site (and that the script itself is toggled on in the dashboard).

## Contributing

PRs and issues are welcome. A few guidelines so changes stay reliable:

- **Keep it one file.** Prefer changes in `script.js` only unless docs or license need an update.
- **Preserve the userscript header.** Leave the `// ==UserScript==` block intact (`@name`, `@match`, `@run-at`, etc.) unless you have a clear reason to change it.
- **Don’t remove Songsterr DOM nodes.** Hide overlays with CSS / click continue links instead. Deleting nodes can break Songsterr’s render state.
- **Test on a live tab.** Reload Songsterr after editing, trigger the paywall/overlay, and confirm: overlay dismisses, playback resumes when expected, playhead stays visible, and manual pause still works.
- **Treat class names as brittle.** Hashed selectors (e.g. `.w_eHuW_modal`) change when Songsterr ships UI updates. Prefer stable hooks (`#control-play`, `use[href*="cursor-playhead"]`) when you can; if you must update hashes, note what broke and what you verified.
- **Keep the scope small.** This script dismisses stuck overlays, auto-resumes, and fixes the playhead — avoid unrelated features or broad site rewrites.
- **Open a focused PR.** One concern per PR, with a short description of the Songsterr behavior you saw and how you tested.
