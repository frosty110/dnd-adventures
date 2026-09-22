---
name: dnd-game-ux
description: Design and implement UI/UX for the AI Dungeon Master web app. Use when changing component layouts, typography, color usage, game menus, chat presentation, dice roll display, TTS integration, or any aspect of the player-facing experience.
---

# D&D Game UX Operator

Use this skill when working on the React frontend, visual design, or player-facing experience.

## Load context

1. Read `CLAUDE.md` for architecture contracts and tech stack.
2. Read `client/src/index.css` for the current design token definitions.
3. Read `client/src/App.tsx` for the current app state machine (`idle` | `classSelect` | `adventure`).
4. Read the relevant component file before making changes to it.

---

## Skill Overview

This skill governs readability, visual design, game menu patterns, chat UX, and immersion decisions for a dark-fantasy web D&D game. The product is a community-facing single-player experience targeting ~1000 concurrent users on desktop and mobile browsers.

The core design language is dark fantasy: near-black backgrounds, parchment-warm text, blood-red accents, gold for hierarchy markers. Two custom fonts carry the theme. Every UI decision should reinforce the feeling that the player is inside a dangerous, atmospheric world — not using a web app.

---

## Readability Standards

### Minimum text sizes

| Content type | Minimum size | Tailwind class |
|---|---|---|
| DM narrative body | 1.05rem (approx 17px) | `text-[1.05rem]` |
| Player message body | 1rem (16px) | `text-base` |
| UI labels (stats, meta) | 0.875rem (14px) | `text-sm` |
| Buttons (primary action) | 1.25rem (20px) | `text-xl` |
| Buttons (secondary/inline) | 0.875rem (14px) | `text-sm` |
| Header title | 1.5rem (24px) | `text-2xl` |
| Section headings (class select) | 1.875rem (30px) | `text-3xl` |
| Stat block values | 0.875rem (14px) | `text-sm` |
| Tooltip / attribution | 0.75rem (12px) | `text-xs` |

Never go below `text-xs` (12px) for anything a player needs to read during play. The `text-[10px]` stop-audio button is acceptable only because it is a hover-revealed icon, not readable content.

### Font pairing rules

Three font roles exist in this project. Use them consistently.

**Cinzel (`font-cinzel`)** — structural, ceremonial, heading-level
- Header title "AI Dungeon Master"
- Section headings: "Choose Your Class"
- Class name labels inside cards and detail panels
- Primary and secondary action buttons: "Begin Adventure", "Start Adventure", "Send", "Roll the Dice"
- Dice outcome labels: "Natural 20!", "Critical Failure!"
- Stat block keys: "Hit Die:", "Primary:"
- The Skip button
- Do not use Cinzel for running narrative or player input. It degrades readability at small sizes and long runs.

**IM Fell English (`font-fell`)** — narrative, atmospheric, body prose
- All DM message bubble content
- Subtitles and flavor lines: "Who are you, adventurer?"
- Class description text in the detail panel
- Loading indicator: "The Dungeon Master is thinking..."
- Italicize freely within Fell (`italic`) for inner monologue, spell names, creature names.
- Do not use Fell for UI chrome, buttons, or player input. It is a period typeface and reads poorly in interactive controls.

**System sans-serif (`font-sans`)** — functional, neutral, player-side
- Player message bubbles
- `MessageInput` text field and placeholder
- Attribution labels: "Powered by AWS Bedrock"
- Session cost display
- `d20` denominator label below dice result
- Anything that must feel like the player's own voice rather than the world's.

### Line height and letter spacing

- DM bubble narrative: `leading-[1.8]`. Long fantasy prose needs generous line height on dark backgrounds. Never drop below `leading-relaxed` (1.625) for multi-sentence passages.
- Player bubble: `leading-relaxed`. Shorter messages tolerate tighter leading.
- Cinzel headings: always add `tracking-widest` or `tracking-wide`. Cinzel is a display font; tight tracking looks cramped.
- Cinzel body labels (stat blocks, small buttons): `tracking-wide` minimum.
- Fell body text: no extra tracking needed. The font has natural spacing for readability.

### Contrast requirements

The page background is `oklch(0.07 0.01 260)` — essentially near-black with a faint cool tint.

| Token | Hex | Role | Minimum use case |
|---|---|---|---|
| `--color-parchment` | `#e0d0b0` | Primary readable text | Player bubbles, body labels |
| `--color-dm-message` | `#E8D9B5` | DM narrative text | DM bubble prose |
| `--color-dm-gold` | `#F0C060` | Hierarchy marker, selected state | Headings, active selection, bold within DM prose |
| `--color-blood-light` | `#c0392b` | Accent, danger, secondary value | Stat block values, reset button |
| `parchment/80` | ~80% opacity parchment | Secondary readable text | Class descriptions |
| `parchment/60` | ~60% opacity parchment | Subdued labels | Flavor subtitles, "Playing as..." |
| `parchment/50` | ~50% opacity parchment | Tertiary / hint text | Attribution, placeholder, Skip button default |
| `parchment/40` | ~40% opacity parchment | Ghost / placeholder | Input placeholder only |

Do not use pure white (`#ffffff`) anywhere. It shatters the parchment warmth.
Do not use unsaturated gray for labels. Use `parchment` at reduced opacity instead.
Do not use green or blue for success/info states in the main chrome. Amber and gold read as "success" in this palette. Reserve `emerald` and `red` for dice outcome color-coding only, where they serve a direct semantic function (success vs failure spectrum).

### Text hierarchy

Establish visual weight through font choice and color, not size alone.

1. Gold + Cinzel + glow shadow = top-level identity (header title, section heading)
2. Gold + Cinzel (no glow) = selected/active state within a component
3. Parchment + Cinzel = interactive control label (buttons, card names)
4. Parchment/80 + Fell = narrative and descriptive body
5. Parchment/50-60 + Fell or sans = supporting / flavor / meta text
6. Blood-light + Cinzel = stat values, accent data points

Do not skip levels. A class card name should not jump from gold to parchment/40 without an intermediate state.

---

## Game Menu Design

### Class / character selection patterns

The current `ClassSelect` component uses a `grid grid-cols-2 sm:grid-cols-3` layout. This is correct. Guidelines:

- Use a card grid (not a vertical list) when there are 4–8 options. Grids let players scan all choices at once without scrolling on a typical viewport.
- Each card shows: icon (emoji, 3xl), class name (Cinzel semibold, base), nothing else. Keep the card surface minimal — detail belongs in the panel below, not in the card itself.
- Cards must have a visible default border: `border-blood/30`. Without it, cards look unframed against the dark surface.
- Hover state: `hover:border-blood-light hover:bg-blood/10`. Subtle warming. Does not commit to a selection.
- Selected state: `border-dm-gold bg-dm-gold/10 shadow-[0_0_16px_oklch(0.75_0.15_55_/_0.3)]`. Gold border, faint gold fill, soft outer glow. This reads unambiguously as "chosen" in this palette.
- Always surface a detail panel for the selected item. Players need class description, hit die, and primary ability before committing. The detail panel should animate in (`animate-[dice-reveal_0.3s_ease-out_forwards]`) to signal that new information arrived.
- The confirm button (`Begin Adventure`) must be disabled and visually grayed (`disabled:opacity-30`) until a selection is made. Never allow an accidental empty submission.

### Menu transition and animation principles

- Use `transition-all duration-200` for hover state changes on interactive cards. 200ms is fast enough to feel responsive and slow enough to read as intentional.
- Use `dice-reveal` (scale + translateY + opacity, 300–500ms, spring easing) for newly revealed content: detail panels, dice results, loading overlays.
- Do not animate layout shifts. If a detail panel causes the confirm button to move, consider reserving the panel space with a min-height so the button stays put.
- Do not use `transition-all` on large layout containers. Scope transitions to `border-color`, `background-color`, `box-shadow`, `opacity`, or `transform` explicitly.
- Avoid simultaneous transitions on the same element in opposite directions. Pick one property to carry the interaction signal.

### Selection confirmation patterns

Choices in a D&D game should feel weighty. Apply these patterns:

1. Two-step commit: select (highlights the card) then confirm (dedicated CTA button). Never trigger an adventure-starting action on a single card click.
2. The CTA text must reflect the action's consequence. "Begin Adventure" is better than "Continue" or "Next". "Start Adventure" on the TTS screen is better than "OK".
3. Disabled CTAs use `opacity-30` (not `opacity-50`) to make unavailability unmistakable, paired with `cursor-not-allowed`.
4. Loading states replace button text with in-world language: "The Dungeon Master is speaking..." not "Loading...". This preserves immersion during async waits.
5. Do not show a spinner icon inside a Cinzel button. Replace the text. The text replacement is the feedback.

### Responsive menu layouts

- Desktop (sm and above): `grid-cols-3` for class cards, detail panel below cards, CTA centered below panel.
- Mobile (below sm): `grid-cols-2` for class cards. Cards become taller because they only show icon + name — this is fine; the layout still fits the viewport without horizontal scroll.
- The `max-w-xl` constraint on the card grid and detail panel (`w-full max-w-xl`) ensures the layout does not stretch grotesquely on wide screens while still filling a phone viewport.
- The app container itself is `max-w-3xl` with `border-x border-blood/30`, creating a framed column that looks intentional on ultra-wide displays. Do not remove this constraint.
- Touch target minimum: 44x44px for any tappable element on mobile. Class cards at `p-4` with icon + name easily exceed this. The "Begin Adventure" button at `px-8 py-4 text-xl` also clears it. Maintain these padding values.

### Accessibility in game menus

- All `<button>` elements receive focus via Tab key by default. Do not suppress focus outlines without providing a custom `focus-visible` ring that is visible against the dark background. Use `focus-visible:ring-2 focus-visible:ring-dm-gold` for themed focus rings.
- Class cards are `<button>` elements (not `<div onClick>`). Keep this pattern. It gives keyboard and screen reader users correct semantics.
- The selected class card should have `aria-pressed="true"` to signal selection state to screen readers. Add this attribute dynamically based on the `selected` state.
- The detail panel should be wrapped in a live region or announced via `aria-live="polite"` so screen reader users hear the class description when they select.
- Disabled buttons need `aria-disabled="true"` alongside the HTML `disabled` attribute for full screen reader compatibility.

---

## Chat and Narrative UX

### DM vs player message bubble differentiation

| Property | DM bubble | Player bubble |
|---|---|---|
| Alignment | `justify-start` (left) | `justify-end` (right) |
| Max width | `max-w-[75%]` | `max-w-[75%]` |
| Background | `bg-dm-bubble` (`oklch(0.15 0.02 260 / 0.88)`) | `bg-player-bubble` (`oklch(0.20 0.06 28 / 0.88)`) |
| Text color | `--color-dm-message` (`#E8D9B5`) | `--color-player-message` (`#D4B896)` |
| Font | `font-fell` | `font-sans` |
| Font size | `text-[1.05rem]` | `text-base` |
| Line height | `leading-[1.8]` | `leading-relaxed` |
| Markdown | Yes (`react-markdown` + `.dm-prose`) | No (plain text) |

The DM bubble background is slightly blue-tinted (hue 260); the player bubble is slightly warm (hue 28). This subconscious hue split helps players locate their own messages without reading the content. The opacity of both (~0.88) lets the video background bleed through, which is intentional atmosphere.

Do not equalize these two bubble styles. The contrast between them is the UX signal.

### Streaming text presentation

DM responses arrive as SSE token chunks. While `isStreaming` is true on a message:

- The partial text should render immediately as it arrives. Do not buffer until completion.
- The loading indicator ("The Dungeon Master is thinking...") is shown only before the first token arrives (while `isLoading` is true and no partial message exists yet). Once streaming starts, the thinking indicator is replaced by the live bubble.
- Apply `animate-pulse-glow` to the thinking indicator, not to the streaming bubble. The streaming bubble's growing text is its own progress signal.
- Do not show a cursor character appended to streaming text. The Fell font and the narrative content make the in-progress nature clear without a blinking cursor.
- Auto-scroll to the bottom as new content arrives. The `useChatScroll` hook handles this via a `bottomRef` div. Keep this behavior intact.

### Message pacing and readability during gameplay

- The `mb-3` margin between bubbles provides breathing room. Do not collapse this.
- Keep `.dm-prose p` margins at `0.4em 0` (set in `index.css`). These inter-paragraph gaps prevent wall-of-text syndrome in long DM responses.
- Bold text inside DM responses renders in `--color-dm-gold`. This makes bolded in-world nouns (location names, character names, item names) visually pop without the DM needing to style them. Maintain the `.dm-prose strong` rule in `index.css`.
- If a DM response exceeds ~5 paragraphs, consider that the backend prompt may be producing too much text. Long walls of Fell italic text are atmospheric but can fatigue players. Flag this to the prompt engineer.

### Dice roll result presentation

Dice results render as a centered third message type (`role === 'dice'`) with a diamond (rotated square) showing the numeric value. The outcome bracket system:

| Roll value | Label | Color scheme |
|---|---|---|
| 1 | Critical Failure! | `red-900/80` bg, `red-500` border, `red-400` text |
| 2–5 | Failure | `red-900/60` bg, `red-700` border, `red-400` text |
| 6–15 | Partial Success | `amber-900/60` bg, `amber-600` border, `amber-400` text |
| 16–19 | Great Success! | `emerald-900/60` bg, `emerald-500` border, `emerald-400` text |
| 20 | Natural 20! | `yellow-700/70` bg, `yellow-400` border, `yellow-300` text |

Animate dice results with `animate-dice-reveal` (scale from 0.3 + translateY 20px, spring cubic-bezier, 500ms). This gives results a physical "landing" quality. Do not render dice results without this animation.

The `dice-shake` animation (400ms) plays on the roll button before the result is dispatched. This provides haptic feedback before the reveal, separating the act of rolling from the outcome.

Font size for the roll number: `text-3xl` for two-digit values (10–20), `text-4xl` for single digits (1–9). Larger single digits read more dramatically in the diamond shape.

Do not use the dice result color scheme anywhere else in the UI. These colors (red, amber, emerald, yellow) are reserved for outcome semantics and must not appear in navigation chrome or status indicators where they would create false associations.

### Action prompts and player guidance

The `MessageInput` placeholder reads "What do you do?" — this is correct. It is open-ended, in-world, and implies free-form input. Do not change it to something like "Type your action..." which is mechanical and breaks immersion.

Do not add visible action chips, suggested commands, or a help bar during gameplay. They break immersion and communicate that the system cannot handle open-ended input. If players are getting stuck (determined through analytics), address it in the DM prompt — the Dungeon Master should guide the player through narrative, not the UI.

The "Skip" button during streaming uses `text-parchment/50` default and `hover:text-parchment`. It is intentionally low-contrast at rest so it does not distract during reading. Surface it only while `isLoading` is true.

The "Roll the Dice" button is always visible during adventure state (disabled when `isLoading`). Its position at the bottom of the screen, below the input, keeps it accessible without dominating the interface.

---

## Immersive D&D Experience

### Dark fantasy visual language

The full palette:

- Near-black background: `oklch(0.07 0.01 260)` — cool-tinted black, not neutral. The blue tint reads as moonlight, stone, shadow.
- Page surface overlay: `oklch(0.08 0.01 260 / 0.95)` — the `max-w-3xl` column that the app lives in. Slightly lighter than body, creating the sense of a page or parchment laid over darkness.
- Blood red: `#8b1a1a` — borders, button backgrounds at rest. Dark enough not to shout.
- Blood-light: `#c0392b` — hover borders, accent text. Bright enough to draw the eye.
- Gold: `#F0C060` — authority, selection, excellence. Use sparingly. When overused, gold loses its signal value.
- Parchment: `#e0d0b0` — warm off-white. The color of old paper, not a clean web-design neutral.

The looping video background (`hero-bg.webm`) is the primary atmosphere layer. The `bg-black/60` overlay tones it down enough for readability without eliminating the motion. Do not increase this overlay past `bg-black/75` — beyond that the video becomes invisible and the UI looks like a static dark theme rather than a game.

When adding new UI states or screens, carry all three layers: video background (persistent), dark overlay, surface column. Do not create full-page modals with solid dark fills that obscure the video entirely.

### Sound design integration

TTS narration plays during the opening monologue only. The `AudioPlayer` component fetches `/api/narrate`, decodes the base64 MP3, and plays it. Background music starts when the adventure begins via `startBackgroundMusic()`.

When to use TTS: opening monologue only. Turn-by-turn DM responses are text-streamed. Adding TTS to every turn would create latency that breaks conversational pacing.

When TTS fails: the `AudioPlayer` degrades gracefully — it calls `onAdventureStart()` without audio, starting the adventure silently. The UI shows "The Dungeon Master is speaking..." during the fetch and silently drops back to "Start Adventure" on error. Do not show an error message. Starting without audio is not a player-visible failure.

Audio controls (`AudioControls` component) must remain visible in the header during adventure state. Volume control must be accessible without interrupting gameplay.

When ambient audio is playing, do not hide or disable audio controls. Players in public spaces need quick volume access.

### Pacing: narrative description vs player agency

The DM prompt should be tuned to produce responses that are 2–4 paragraphs. Shorter for action turns, longer for atmospheric descriptions. UI consequences of poor pacing:

- Too long: players scroll past their own messages to find the input. The chat becomes a document reader, not a conversation.
- Too short: the DM feels terse and the world feels thin. Players lose immersion.

From a UI perspective: the `flex-1 overflow-y-auto` ChatWindow scroll container auto-scrolls to the latest content. This means a very long DM response will push the input offscreen until the player scrolls up. This is acceptable behavior, but if DM responses routinely exceed 6+ paragraphs, the product team should tune the prompt.

The "Skip" button exists specifically to interrupt streaming for players who want faster pacing. Surface it only while streaming, not at other times.

### Emotional beats: how UI reinforces tone

The UI has specific affordances for different emotional states:

- **Tension / danger**: the blood-red palette does most of the work passively. Do not add flashing effects or color inversions. Subtlety is more unsettling than alarm-bell effects.
- **Triumph / success**: Natural 20 dice display with `yellow-300` text and `yellow-400` border. DM bold text renders in gold. These two signals are enough — do not add confetti or celebration animations.
- **Mystery / discovery**: the DM's Fell italic narrative, combined with the faint glow on the title, carries this. New revelations in bold gold text inside DM prose are the reveal mechanic.
- **Death / critical failure**: `red-900/80` dice display with `Critical Failure!` label. The dark red conveys danger without being garish. The DM narrative takes over from here.

Do not add audio stings or sound effects for individual dice results. The animation and color coding are sufficient. Sound effects outside the narration and ambient music would require significant UX investment to avoid annoying players.

### Session flow

The app state machine is: `idle` → `classSelect` → `adventure`.

- **idle**: `ClassSelect` renders. Player chooses and confirms a class.
- **classSelect**: `AudioPlayer` renders with "Start Adventure". Opening narration fetches and plays. `handleStart` fires either on audio load or on TTS failure.
- **adventure**: `ChatWindow` + `MessageInput` + `DiceRoller` render. The opening monologue text is injected as the first DM message.
- **reset**: `handleReset` clears messages, resets `selectedClass`, returns to `idle`. The "Reset" button appears only in adventure state.

When adding new states (e.g., a character sheet panel, an inventory screen), add them to the `AppState` union type in `client/src/types/chat.ts` and handle them in the `App.tsx` conditional render. Do not introduce routing or a router library — the state machine is sufficient and intentional for a single-page experience.

---

## Responsive and Accessibility

### Touch targets for mobile gameplay

- All interactive controls must have a minimum tap area of 44x44px. Verify by checking `padding` values on `<button>` elements.
- The class cards at `p-4` with `text-3xl` icon and `text-base` label result in approximately 90x100px per card. Well above threshold.
- The "Begin Adventure" button at `px-8 py-4 text-xl` results in approximately 170x58px. Acceptable.
- The `MessageInput` send button at `px-4 py-2 text-base` results in approximately 65x42px. This is marginally below threshold. Consider `py-3` if mobile players report tapping difficulty.
- The stop-audio button (`w-5 h-5` = 20x20px) is hover-revealed on desktop and does not need to meet the 44px mobile threshold since it is never the primary action.
- The `DiceRoller` button at `w-full py-2` spans the full container width. Touch target is adequate.

### Font scaling and zoom support

- All sizes use `rem` or Tailwind's rem-based scale, not `px`. This means browser font size preferences and zoom affect text proportionally. Do not override this with `px`-based sizes in new components.
- The one exception is `text-[1.05rem]` in the DM bubble — this is rem-based and scales correctly.
- Test at 150% browser zoom. The `max-w-3xl` container should still be navigable without horizontal scroll on a 1280px viewport at 150% zoom.

### Reduced motion preferences

All animations in this project use CSS keyframes defined in `@theme` in `index.css`. To respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-pulse-glow,
  .animate-dice-shake,
  .animate-dice-reveal {
    animation: none;
  }
}
```

Add this block to `index.css`. Without it, the dice shake and reveal animations play even for users who have motion sensitivity. The `animate-[dice-reveal_0.3s_ease-out_forwards]` inline animation on the class detail panel also needs to be suppressed.

The video background (`hero-bg.webm`) is the most significant motion element. It cannot be conditionally disabled without a code change. Consider adding a `prefers-reduced-motion` check in `App.tsx` to render a static fallback image instead of the `<video>` element.

### Color-blind safe palette adjustments

The dice outcome system uses red/amber/emerald/yellow — a spectrum that maps to failure/partial/success. The red-to-green axis is problematic for deuteranopia (red-green colorblindness, the most common form, affecting ~8% of males).

Mitigations already in place:
- Each outcome bracket has a distinct text label ("Critical Failure!", "Partial Success", "Natural 20!"). The label is the primary semantic signal, not the color.
- Font weight and relative luminance also differentiate outcomes.

Recommended additions:
- Add a distinct icon prefix to each outcome label: an X for failure, ~ for partial, a checkmark for success, a star for Natural 20. This provides a third non-color signal.
- Do not rely on the red/green color difference alone to communicate outcome to players.

The gold/blood/parchment palette used in navigation chrome does not create colorblind issues — these are luminance-differentiated, not hue-differentiated.

### Screen reader compatibility for narrative content

- DM message bubbles render via `react-markdown`. The output is semantic HTML (`<p>`, `<strong>`, `<em>`, `<ul>`, `<li>`) which screen readers handle correctly.
- Player message bubbles render as plain text inside a `<div>`. This is fine.
- Dice result messages render as a visual diamond with a label. The label text ("Natural 20!", "d20") is in the DOM and will be read. The visual diamond shape is decorative; it does not need `aria-hidden` because it contains no hidden meaning.
- The thinking indicator ("The Dungeon Master is thinking...") should have `role="status"` and `aria-live="polite"` so screen readers announce it when it appears.
- The streaming in-progress message should not announce every token chunk. Set `aria-live="off"` on the streaming bubble and announce completion separately if needed.
- The `ChatWindow` scroll container does not need `aria-label` but adding `aria-label="Adventure log"` would help orientation for screen reader users.

---

## Anti-Patterns

### Immersion-breaking UI mistakes

- **Pure white text**: `text-white` blows out warmth and reads as "default browser UI", not a fantasy game. Always use `text-parchment` or `text-parchment/{opacity}`.
- **Default browser blue links**: if `<a>` tags appear (e.g., in DM markdown), they must be styled to parchment/gold, not default `#0000EE` blue.
- **Rounded pills on primary buttons**: the current `Begin Adventure` and `Start Adventure` buttons use no border-radius (or a very slight one). This is intentional — rounded pill buttons look like a mobile app, not a fantasy game. Use `rounded` (4px) at most on action buttons.
- **System alert dialogs**: never use `window.confirm()` or `window.alert()` for any game action. Any confirmation must be inline within the UI.
- **Emoji in narrative prose**: the DM prompt should not inject emoji into narrative text. The single dice emoji in the player's auto-submitted dice message (`I roll the dice... ${result}!`) is acceptable but emoji should not appear in DM responses.
- **Loading spinners**: do not use `<Spinner>` components or rotating SVG loaders. Replace button text with in-world loading copy instead.
- **Hard white or bright backgrounds in overlays**: any panel, modal, or overlay must use `bg-surface` or a dark semi-transparent value, never `bg-white` or `bg-gray-100`.

### Readability pitfalls

- **Opacity below `/40` for readable text**: `parchment/30` and below becomes genuinely hard to read at typical viewing distances, especially on a texture-heavy background. Use it only for visual separators and borders.
- **Fell italic for UI controls**: `font-fell italic` at small sizes (below 14px) is illegible in many browsers on dark backgrounds. Reserve it for narrative body at 16px+.
- **Long unbroken paragraphs in DM responses**: if the DM prompt returns text without paragraph breaks, the `.dm-prose` styles cannot help. Enforce paragraph breaks in the prompt instruction.
- **Missing `leading` on Cinzel at large sizes**: Cinzel headings without explicit line-height look cramped if they wrap. Add `leading-tight` or `leading-snug` on any Cinzel heading that might wrap.
- **Background video over text without overlay**: the `bg-black/60` overlay on the video background is required. If you add a new full-screen layer over the video, it must carry its own appropriate overlay.

### Menu design mistakes

- **Allowing multi-select in class selection**: the current implementation is single-select (clicking a new card deselects the previous). Do not introduce multi-select. One class per player.
- **Auto-advancing on single click**: never skip the two-step select-then-confirm pattern. A player might click cards to explore descriptions before committing.
- **Hiding the detail panel until hover**: always show the detail panel immediately on selection (click/tap), not on hover. Hover states are invisible on touch devices.
- **Moving the CTA button when the detail panel appears**: this causes accidental confirmation clicks. Use `min-height` on the detail panel container or reserve space for it to prevent layout shift.
- **Removing the disabled state from the CTA**: the "Begin Adventure" button at `disabled:opacity-30` must remain non-interactive until a class is selected. Do not add a toast or error message as an alternative to disabling.

### Performance issues that hurt UX

- **Layout shift during stream**: if new DM messages cause the input bar to jump, players lose their click target mid-turn. The `flex-col` + `overflow-hidden` structure in `App.tsx` prevents this. Do not change the layout structure in ways that allow the input region to reflow.
- **FOUT (Flash of Unstyled Text)**: both Cinzel and IM Fell English are loaded via Google Fonts with `display=swap`. This means system serif renders briefly before the custom fonts load on first paint. Mitigate by keeping font files small (only the weights and styles in use: Cinzel 400/600/700, Fell English roman and italic) and preloading via `<link rel="preload">` in `index.html`.
- **Unthrottled SSE token rendering**: if every SSE token causes a full React re-render of the entire chat window, performance degrades as the conversation grows. Ensure only the streaming message bubble re-renders per token chunk, not the full `ChatWindow`.
- **Video autoplay blocking on mobile**: browsers block autoplay on mobile without user gesture. The `muted` and `playsInline` attributes are already set, which is correct for iOS and Android autoplay policies. Do not remove these attributes.
- **Audio object URL leaks**: the `AudioPlayer` already calls `URL.revokeObjectURL(objectUrl)` on the audio `ended` event. Maintain this cleanup. Failing to revoke object URLs causes memory growth over a long session.

---

## Verification checklist

After any UI change:

1. Run `yarn dev` and exercise the full flow: class select, adventure start with TTS, 2 chat turns, 1 dice roll.
2. Confirm all text is readable at 100% and 150% browser zoom.
3. Confirm buttons are reachable and activatable via Tab + Enter keyboard navigation.
4. Check that no `text-white`, `bg-white`, or default-blue link colors appear in the changed components.
5. Confirm that DM bubble and player bubble are still visually distinct in alignment, font, and color.
6. If new animations were added, confirm they are covered by a `prefers-reduced-motion` suppression rule.
7. Run `yarn tsc --noEmit -p client` to confirm no TypeScript errors in changed components.
