/*
 * FICTIONAL THEATRICAL ARRIVAL SIMULATION — NOT HISTORICAL LANDING TIMES.
 *
 * All times are plausible Gander local daylight times on 11 September 2001.
 * A few positions are inspired by recollections (VS 75 first, AA 49 36th,
 * CO 45 37th, US 3 last; DL 15 around the middle). The other placements
 * and ALL times are fictional. Never copy these into data/flights.js.
 *
 * Used only by arrival-chaos. The clock does not progress; each row's
 * displayed ETA is regenerated on its own seeded refresh cadence.
 */
window.FIDS_DATA = window.FIDS_DATA || {};
window.FIDS_DATA.arrivalSimulation = {
  "vs75": { order: 1, eta: "10:55" },
  "ei105": { order: 2, eta: "10:59" },
  "co23": { order: 3, eta: "11:06" },
  "tz7161": { order: 4, eta: "11:12" },
  "ba1503": { order: 5, eta: "11:15" },
  "nw61": { order: 6, eta: "11:18" },
  "lh400": { order: 7, eta: "11:22" },
  "ua929": { order: 8, eta: "11:26" },
  "dl129": { order: 9, eta: "11:31" },
  "aa101": { order: 10, eta: "11:37" },
  "sn539": { order: 11, eta: "11:43" },
  "co29": { order: 12, eta: "11:48" },
  "dl141": { order: 13, eta: "11:54" },
  "ma90": { order: 14, eta: "11:57" },
  "dl37": { order: 15, eta: "12:00" },
  "lh416": { order: 16, eta: "12:06" },
  "lh440": { order: 17, eta: "12:10" },
  "af004": { order: 18, eta: "12:12" },
  "us27": { order: 19, eta: "12:16" },
  "dl49": { order: 20, eta: "12:19" },
  "dl15": { order: 21, eta: "12:25" },
  "tw819": { order: 22, eta: "12:30" },
  "aa63": { order: 23, eta: "12:36" },
  "lh438": { order: 24, eta: "12:46" },
  "vs21": { order: 25, eta: "12:54" },
  "ba2193": { order: 26, eta: "12:58" },
  "tz8733": { order: 27, eta: "13:05" },
  "az644": { order: 28, eta: "13:13" },
  "reach4892": { order: 29, eta: "13:18" },
  "reach3082": { order: 30, eta: "13:28" },
  "reach113": { order: 31, eta: "13:35" },
  "reach3076": { order: 32, eta: "13:43" },
  "aeroflot-paris": { order: 33, eta: "13:52" },
  "tz819": { order: 34, eta: "13:58" },
  "co5": { order: 35, eta: "14:09" },
  "aa49": { order: 36, eta: "14:14" },
  "co45": { order: 37, eta: "14:20" },
  "us3": { order: 38, eta: "14:27" },
};
