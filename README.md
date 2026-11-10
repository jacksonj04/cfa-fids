# Gander International Airport — FIDS simulator (11 September 2001)

A self-contained flight information display for theatrical stage dressing. It
reproduces a public-facing arrivals/departures board of the period: monochrome
phosphor, fixed-width characters, no branding, no modern chrome.

No build step, no backend, no network access, no dependencies.

## Running it

Open `index.html` in a browser. That is the whole procedure — the data is loaded
as plain scripts, so it works straight off disk over `file://`.

If you would rather serve it:

```bash
cd gander-fids
python3 -m http.server 8777
# http://127.0.0.1:8777/
```

For a venue screen, open with `?presentation=true` and press `F` for
fullscreen.

## The two states

| URL                              | What it is                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html?state=arrival-chaos` | The airport during the diversion. Seeded chaos: rows refresh slowly, ETAs drift a few minutes around fictional landing times and sometimes change to `DUE`, `DELAYED`, `EXPECTED` or `--:--`, with occasional blinking.                                   |
| `index.html?state=departures`    | The aftermath. The same 38 aircraft, every one of them `DEPARTED`. Calm scrolling messages, no chaos staging.                                                        |

Both states paginate the same 38 flights: 16 rows per page, three pages,
rotating automatically.

## Controls

Keyboard (works in presentation mode too):

| Key       | Action                                           |
| --------- | ------------------------------------------------ |
| `1` / `2` | Arrivals / departures                            |
| `Space`   | Pause and resume all animation and page rotation |
| `←` / `→` | Previous / next page                             |
| `L`       | Lock / unlock the current page (stops rotation)  |
| `P`       | Toggle presentation mode                         |
| `T`       | Cycle phosphor colour (green, amber, white)      |
| `C`       | Toggle the CRT treatment                         |
| `F`       | Fullscreen                                       |

URL parameters:

| Parameter      | Values                                 | Notes                                       |
| -------------- | -------------------------------------- | ------------------------------------------- |
| `state`        | `arrival-chaos`, `departures`          | Defaults to the arrivals board              |
| `page`         | `1`–`3`                                | Starting page                               |
| `pagelock`     | `true` / `false`                       | Hold the current page; no auto-rotation     |
| `presentation` | `true` / `false`                       | Hides the operator bar and the mouse cursor |
| `theme`        | `green`, `amber`, `white`              |                                             |
| `crt`          | `on` / `off`                           |                                             |
| `rows`         | number                                 | Rows per page, overrides the config         |
| `rotate`       | seconds                                | Page rotation; `0` holds the page           |
| `tick`         | milliseconds                           | Animation tick, default 250                 |
| `seed`         | string                                 | Overrides arrivals chaos staging seed       |

Off presentation mode there is a thin operator bar along the bottom showing the
current state, page, flight count and whether the board is paused. It is the
only piece of modern UI in the app.

## Editing the flights

Everything historical lives in `data/flights.js`. Fictional arrival ordering and ETAs
live separately in `data/arrival-simulation.js`, so no simulated values are
mistaken for historical facts. Edit either file and reload.

```js
{
  id: "nw61",
  flightNumber: "NW 61",   // null where not established
  airline: "Northwest",
  origin: "Amsterdam",     // title case; the renderer uppercases it
  destination: "New York", // the originally intended destination
  scheduledTime: null,     // "HH:MM" or null
  landingTime: null,
  departureTime: null,
  military: false,
  confidence: "high",      // high | medium | low
  notes: "",
}
```

Two rules the app is built around:

- **Unknown means `null`.** Every time field in the current dataset is `null`,
  because the landing and departure times have not been established. The
  arrivals board uses a **separate fictional schedule** to dress the unknown
  landing times; a genuine `landingTime` overrides simulation. Do not put
  invented times in `data/flights.js`.
- **Uncertainty is preserved, not tidied away.** The Aeroflot Paris–New York
  LaGuardia row is marked `confidence: "low"`: no matching 2001 schedule was
  found (Aeroflot’s real New York flights were Moscow–JFK as SU 100/101/102).
  The board shows an invented `SU 103` in that Americas long-haul number band
  so the row still reads as a flight, with the caveat kept in `notes`.

`confidence` is editorial — our confidence in the row, not a fact about the
flight — and is not displayed. The four USAF `REACH` callsigns are marked
`medium`; the Aeroflot row is `low`. The dataset is 38 aircraft including the
four military flights.

## Changing how it looks and behaves

All presentation lives in `data/display-states.js`. Nothing there changes the
flight data, and changing any of it requires no changes to rendering code.

A state defines its columns, and each column says how wide it is and which
flight field feeds it:

```js
{ key: "time", label: "TIME", width: 10, field: "landingTime", placeholder: "--:--" }
```

Set `enabled: false` on a column to hide it without deleting it. Widths are in
characters, and the board is exactly as wide as the columns add up to (80 at
present), so it stays aligned like a character terminal rather than a table.

### Staging (arrivals chaos)

The 38 flights have a fixed **fictional** arrival order and estimated times in
`data/arrival-simulation.js`. None of the times are claimed to be a real
touchdown timestamp. The first, roughly middle, and last few positions are
inspired by eyewitness accounts; the others are speculative. The arrivals board
uses this order for pagination; departures retains the original data order.

Each flight refreshes independently on a seeded cycle (20–120 seconds). It
blanks and reveals its columns from left to right, then shows one of these:

- 65%: the simulated ETA, independently varied by ±5 minutes
- 15%: `DUE`
- 8%: `DELAYED` (blinking)
- 6%: `EXPECTED` (blinking)
- 6%: `--:--`

This is **not** a running historical clock. All 38 rows remain on the board;
the visible information changes as though updates are arriving in the airport.
There's deliberately no `CANCELLED` state: the aircraft on this board really
did land at Gander. Gates remain unknown (`----`) with occasional blink.

Configure the pool, ETA jitter, refresh cadence and blink in
`data/display-states.js`. For example:

```js
staging: {
  seed: "gander-2001",
  statuses: [
    { weight: 65, eta: true },
    { weight: 15, value: "DUE" },
    { weight: 8, value: "DELAYED", blink: true },
    { weight: 6, value: "EXPECTED", blink: true },
    { weight: 6 },
  ],
  etaJitterMinutes: 5,
  holdSeconds: { min: 20, max: 120 },
  gateBlinkChance: 10,
  refresh: { blankSeconds: 0.5, columnRevealSeconds: 0.25 },
  blink: { periodTicks: 12, onTicks: 7 },
},
```

Same seed → same refreshes and ETA changes. Pass `?seed=other` to
reshuffle. A genuine `landingTime` in `data/flights.js` always takes
precedence. The departures board is unaffected.

### Blink

One style only: show the value for `onTicks`, then blank for the rest of
`periodTicks`. Phase comes from a hash of the cell identity so the board does
not pulse in unison.

### Messages

The bottom line is configured per state:

```js
messages: {
  mode: "scroll",           // scroll | rotate | static | none
  speedCharsPerTick: 1,
  items: ["ALL FLIGHTS SUBJECT TO DELAY"],
}
```

`scroll` runs everything as one continuous marquee, `rotate` shows one message
at a time for `holdSeconds`, `static` centres the first item.

### CRT treatment

`css/terminal.css` drives the whole look from custom properties at the top:
phosphor colours, glow radius, scanline spacing and opacity, flicker strength,
vignette, letter spacing, line height. Defaults are restrained deliberately —
it has to be readable from the back of a room. `crt=off` or the `C` key zeroes
the effects.

The board sizes itself at runtime to fill the viewport: it measures the actual
character width of whatever monospace font the machine resolved and scales the
font so the grid fits the screen in both directions. There is no web font, so
nothing depends on an internet connection.

## Layout

```
index.html                 markup only — no flight data, no configuration
css/terminal.css           phosphor terminal styling, CRT effects
js/animations.js           hash, blink, generative staging timeline
js/fids.js                 display engine: data + state -> character grid
js/states.js               loads and merges display states
js/app.js                  bootstrap, URL parameters, keyboard, tick loop
data/flights.js            historical data only
data/arrival-simulation.js fictional landing order and times; theatrical only
data/display-states.js     presentation configuration only
```

## A note on what this is

It is theatrical stage dressing inspired by the Gander diversions, not a
recreation of any real airport board. Flight rows are drawn from historical
lists where we have them; presentation, staging, and invented details (such as
the Aeroflot flight number) are for the stage. Where the history is uncertain
the data says so.
