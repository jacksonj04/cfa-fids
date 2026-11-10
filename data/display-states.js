/*
 * Display configuration. PRESENTATION ONLY - no historical facts live here,
 * and nothing here changes the flight data in data/flights.js.
 *
 * Each state describes how the same 38 flights should be presented: which
 * columns appear, how wide they are, which data field feeds each column, what
 * to show when a value is unknown, how the board paginates, and what the
 * message line says.
 *
 * Generative `staging` (arrivals) is theatrical dressing: a seeded status pool
 * and row-refresh cascade that make the board feel mid-crisis. These are stage
 * directions, not historical claims, which is exactly why they are here and
 * not in flights.js.
 *
 * Column spec:
 *   key          string   unique within the state
 *   label        string   column heading
 *   width        number   width in characters (the board is a character grid)
 *   field        string   flight field to read, e.g. "landingTime"
 *   value        string   constant text, used instead of `field` if present
 *   placeholder  string   shown when the resolved value is null/empty
 *   align        string   "left" (default) or "right"
 *   enabled      boolean  set false to hide the column without deleting it
 *
 * Staging spec (generative, see js/animations.js Staging):
 *   seed, statuses[{ weight, value?, eta?, blink? }], holdSeconds{ min, max },
 *   etaJitterMinutes, refresh{ blankSeconds, columnRevealSeconds },
 *   blink{ periodTicks, onTicks }
 */
window.FIDS_DATA = window.FIDS_DATA || {};

window.FIDS_DATA.displayStates = {
  defaultState: "arrival-chaos",

  // Merged into every state; a state may override any of these.
  defaults: {
    airportName: "Gander International Airport",
    tickMs: 250,
    transform: ["uppercase", "ascii"],
    placeholders: {
      text: "----",
      time: "--:--",
    },
    pagination: {
      rowsPerPage: 16,
      rotateSeconds: 14,
      footerFormat: "PAGE {page} OF {pages}",
    },
    order: { mode: "dataset" },
    messages: {
      mode: "none",
      items: [],
      speedCharsPerTick: 1,
      holdSeconds: 8,
      gap: "     ***     ",
    },
    staging: {},
  },

  states: {
    /* ---------------------------------------------------------------
     * State 1: the airport during the diversion.
     * The board says very little, because very little was known.
     * --------------------------------------------------------------- */
    "arrival-chaos": {
      order: { mode: "shuffle", seed: "gander-arrival-rows" },
      label: "Arrivals",
      header: {
        left: "ARRIVALS",
        right: "TUE 11 SEP 2001",
      },
      columns: [
        {
          key: "flight",
          label: "FLIGHT",
          width: 12,
          field: "flightNumber",
          placeholder: "----",
        },
        {
          key: "airline",
          label: "AIRLINE",
          width: 28,
          field: "airline",
        },
        { key: "from", label: "FROM", width: 22, field: "origin" },
        {
          key: "time",
          label: "TIME",
          width: 10,
          field: "landingTime",
          placeholder: "--:--",
        },
      ],
      messages: {
        mode: "scroll",
        speedCharsPerTick: 1,
        items: [
          "PLEASE CHECK WITH AIRLINE REPRESENTATIVES FOR FURTHER INFORMATION",
          "WELCOME TO GANDER INTERNATIONAL AIRPORT",
        ],
      },
      staging: {
        seed: "gander-2001",
        // A time is the norm, but rows occasionally lose information.
        // These are weighted per row refresh; no fabricated landing time is
        // ever written to the historical data.
        statuses: [
          { weight: 65, eta: true },
          { weight: 15, value: "DUE" },
          { weight: 8, value: "DELAYED", blink: true },
          { weight: 6, value: "EXPECTED", blink: true },
          { weight: 6 },
        ],
        etaJitterMinutes: 5,
        holdSeconds: { min: 20, max: 120 },
        refresh: {
          blankSeconds: 0.5,
          columnRevealSeconds: 0.25,
        },
        blink: {
          periodTicks: 12,
          onTicks: 7,
        },
      },
    },

    /* ---------------------------------------------------------------
     * State 2: the aftermath. Same aircraft, nothing moving, nothing
     * flashing, nothing uncertain. All of them left.
     * --------------------------------------------------------------- */
    "departures": {
      order: { mode: "shuffle", seed: "gander-departure-rows" },
      label: "Departures",
      header: {
        left: "DEPARTURES",
      },
      pagination: {
        rowsPerPage: 16,
        rotateSeconds: 18,
        footerFormat: "PAGE {page} OF {pages}",
      },
      columns: [
        {
          key: "flight",
          label: "FLIGHT",
          width: 12,
          field: "flightNumber",
          placeholder: "----",
        },
        {
          key: "airline",
          label: "AIRLINE",
          width: 28,
          field: "airline",
        },
        {
          key: "destination",
          label: "DESTINATION",
          width: 30,
          field: "destination",
        },
        { key: "status", label: "STATUS", width: 10, value: "DEPARTED" },
      ],
      messages: {
        mode: "scroll",
        speedCharsPerTick: 1,
        items: [
          "HAVE A SAFE ONWARD JOURNEY",
          "A candle's in the window and our kettle's always on",
        ],
      },
      staging: {},
    },
  },
};
