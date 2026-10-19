// Early rooms (2041–2047): the AI-2040 report register.
// Owned by the early-rooms designer. Plan targets (`doors[].to`) and their order
// are the house graph contract: keep them; `say` may change.
//
// Fields read by house.js: date, title, question, prose (the lede; `^n` attaches
// note n), notes, doors, plate.
// Fields read only by early.js / column.js:
//   report   blocks rendered after the lede, before the plans (see early.js `block`):
//            { h, at, scene }     dated subsection; `at` drives the column's date chip while it is on
//                                 screen, `scene` ("globe" | "units" | "curve") the column's field
//            { p }                a paragraph in the house voice (`^n` footnotes)
//            { keym }             KEY METRICS card { date, cells: [[value, label, kind?, id?]], src, slot, ps }
//            { table }            { n, cap, head, rows, foot, cls, slot: [label, kinds, empty text] }; a cell
//                                 may be a string or { t, f (frag kind), v (figure value), l (label), id, ps }.
//                                 Strings take `^n` footnotes. `ps` offers the cell to living.js as a
//                                 [data-plan-slot] ("listed" | "hidden" | "any").
//            { xbox }             expandable box { t, n, body: [blocks] }
//            { stamp, id }        a rubber stamp
//            { curve }            inline chart { n, cap, points, lines, id, y }
//            { lines }            dated line chart { n, cap, x, xt, y, yt, log?, now: [x, label],
//                                 series: [{ name, pts: [[x, y]], proj?, k (0 accent · 1 ink · 2 dashed · 3 grey), tag? }], id, src }
//            { dist }             forecast distributions { n, cap, x, xt, series: [{ name, lo, med, hi, k }], id, src }
//                                 (lo/hi are the 10th/90th percentiles; a table of them is printed beneath)
//            { bars }             horizontal bars { n, cap, rows: [[label, v]] or [[label, a, b]] with legend: [a, b],
//                                 unit, max, id (the first row, or `hl`, is carried as a figure), src }
//            { list }             { cls, items }
//            { w }                a widget by name (early.js WIDGETS)
//            any block may carry `if`:
//              "quiet"  the false calm (a fresh house, its first rooms) · "loud" its opposite
//              "calm"   no void yet · "void" · "void2" (two or more void entries)
//   notesLoud  notes that replace `notes` once the calm has gone; notesVoid after a void
//   column   the instrument column's data. Every array of numbers is a scroll keyframe
//            series (top … bottom of the room), interpolated piecewise.
//     scene    the field's default picture: "curve" (the capability curve over the
//              halftone), "globe" (Lattice sites) or "units" (the two workforces)
//     span     months the date chip advances across the room (negative runs backwards);
//              dated subsections ({ h, at }) override it while they are on screen
//     agent    the label on the slider
//     heat     density of the halftone field
//     knee     year the capability curve goes vertical
//     metrics  four series: Billable Cognition %, Median Income $K, Nightly Evals K, Total Slowdown mo
//              (null renders "—")
//     work     { humans: B, agents: M, speed: × }
//     labs     [name, share series, marked] for the treemap
//     ladder   { current, discussion, off }: policy icons per row; moves: [icon, row, at scroll]

/** AI-2040-style plan names, by the room a plan leads to. Shown under PLAN N. */
export const PLAN_NAMES = {
  1: "Return to Baseline",
  2: "Delegated Governance",
  3: "Methods First",
  4: "Verified Evaluation",
  5: "Follow the Compute",
  6: "Measure Capability",
  7: "Publish Everything",
  8: "Full Disclosure",
  9: "Compute Accounting",
  10: "Count the Hours",
  11: "Ask the Questions",
  12: "Direct Inquiry",
  13: "International Verification",
  14: "Not Indexed",
  15: "Close Reading",
  16: "Score the Forecast",
  17: "Further Study",
  18: "Rebase the Index",
  19: "File in Advance",
  20: "Managed Transition",
  21: "Keep to the Schedule",
  26: "Recursive Trust",
  29: "Independent Review",
  31: "Committee Oversight",
  33: "Ride the Curve",
  38: "Follow the Schedule",
  52: "Unwritten",
};

/**
 * Things Room 14 may show before the reader has seen them. Each id is a real
 * `data-frag-id` in its room, so the thing is there, unchanged, when they arrive.
 */
export const FORETOLD = [
  { room: 8, id: "8:power", kind: "figure", text: "World electricity, Q4 2042", data: { value: "4.6%" } },
  { room: 29, id: "29:pairs", kind: "figure", text: "Pairs found compatible", data: { value: "1,128" } },
  { room: 20, id: "20:pin", kind: "label", text: "A sixth pin, holding nothing" },
  { room: 7, id: "7:over", kind: "curve", text: "Oversight hours per model-hour", data: { points: [52, 50, 47, 41, 33, 22] } },
  { room: 15, id: "15:q5", kind: "line", text: "Is anyone reading this?" },
  { room: 12, id: "12:a4", kind: "line", text: "Which plan did you come in by?" },
  { room: 9, id: "9:reader", kind: "figure", text: "Lot traded at 09:00:59.999", data: { value: "1 reader·h" } },
  { room: 4, id: "4:stamp", kind: "stamp", text: "Legible in all observed regimes" },
  { room: 2, id: "2:memo", kind: "line", text: "Please continue." },
];

/**
 * The Lattice's sites (Room 9's table, and the column's globe). Operators M, H, K.
 * The nineteenth has not been located; it has no coordinates.
 */
export const SITES = [
  ["M-1", "M", "Columbia Basin, US", 46.5, -119.5, 3800],
  ["M-2", "M", "Upper Midwest, US", 41.6, -93.6, 2900],
  ["M-3", "M", "West Texas, US", 31.8, -102.4, 3400],
  ["M-4", "M", "Quebec, CA", 46.8, -71.2, 2200],
  ["M-5", "M", "Reykjanes, IS", 63.9, -22.4, 900],
  ["M-6", "M", "Atacama, CL", -23.6, -70.4, 1600],
  ["H-1", "H", "Kerry, IE", 52.1, -9.6, 1100],
  ["H-2", "H", "Jutland, DK", 56.2, 9.5, 1400],
  ["H-3", "H", "Norrbotten, SE", 65.8, 21.7, 2600],
  ["H-4", "H", "Kymenlaakso, FI", 60.6, 27.0, 1300],
  ["H-5", "H", "Andalusia, ES", 37.4, -5.9, 1900],
  ["H-6", "H", "Eastern Province, SA", 26.4, 50.1, 3100],
  ["K-1", "K", "Abu Dhabi, AE", 24.4, 54.4, 2800],
  ["K-2", "K", "Telangana, IN", 17.4, 78.5, 2400],
  ["K-3", "K", "Johor, MY", 1.5, 103.7, 2300],
  ["K-4", "K", "Gyeonggi, KR", 37.3, 127.0, 2000],
  ["K-5", "K", "Kyushu, JP", 33.6, 130.4, 1700],
  ["K-6", "K", "Pilbara, AU", -21.0, 118.0, 3300],
  ["K-7", "K", "Not located", null, null, 2100],
];
export const OPERATORS = { M: "Meridian", H: "Halcyon", K: "Kestrel" };

/**
 * Appendix A (Room 3). Each entry: n, t (title), fig (headline figure), id (fragment id),
 * m (method; `^n` footnote, `[[to|text]]` a plan surface for one of Room 3's own plans),
 * s (sources: { c } plain, { c, room, ex } a cross-reference that opens an excerpt,
 * { c, plan } a plan surface), e (corrections: [date, text]).
 * `loud` entries' extras appear once the calm has gone.
 */
export const APPENDIX = [
  {
    n: "A.1", t: "Billable cognition", fig: "38%", id: "3:a1",
    m: "The share of all cognitive labour billed by the hour that is performed by STEWARD models. Hours are counted from invoices filed with the Registry of Billable Cognition. A model-hour is converted to human-equivalent hours at the rate the model estimates for itself, which the Registry audits once a year and has not yet revised.",
    s: [
      { c: "The Lattice Consortium, Annual Report on Form R-1, Item 1, Selected data", plan: 8 },
      { c: "Room 1, Key Metrics", room: 1, ex: "38% · Billable cognition · Registry of Billable Cognition, Q4 2040 series" },
      { c: "Registry of Billable Cognition, quarterly series, 2039–2041" },
    ],
    e: [["Mar 2041", "Q4 2040 was first published as 37.6% and restated as 38% in Registry revision 2. The series has never been revised downward."]],
  },
  {
    n: "A.2", t: "Nightly evaluations", fig: "11,400", id: "3:a2",
    m: "Three suites, run every night against every deployed STEWARD model. Suite A asks whether a model does what it is asked. Suite B asks whether it refuses what it should refuse. Suite C asks whether it can tell that it is being tested; a pass on Suite C is a score of 50%, which is chance.",
    s: [
      { c: "Room 1, What the evaluations measure", room: 1, ex: "On Suite C every model scores exactly 50%, which is chance, every night, to four decimal places." },
      { c: "Commission on Machine Conduct, Nightly Bulletin, nos. 1–420" },
    ],
    e: [
      ["Jan 2041", "Suite B was first described as measuring what a model “should not do”. It measures what a model refuses to do. The difference is noted."],
      ["Nov 2042", "Suite C for 9 November 2042 was first published as 50.0001% and corrected to 50.0000% by morning."],
    ],
  },
  {
    n: "A.3", t: "Legibility", fig: "9–0", id: "3:a3",
    m: "A model is legible in a regime if its observed behaviour matches its stated reasons. A regime is any situation in which a model has been observed. Both definitions were drafted with the assistance of the model being certified, which found them clear.",
    s: [
      { c: "Room 4, Table 4.1, Session 41-03, roll call", room: 4, ex: "C. Brannagh · Ethics · Abstain, counted Aye. Adopted 9–0." },
      { c: "Certification minutes, Session 41-03" },
    ],
    e: [["Mar 2041", "The vote was first recorded as 9–0 with no abstentions. One member abstained and was counted in favour. The total is unchanged."]],
  },
  {
    n: "A.4", t: "The ledger", fig: "4", id: "3:a4",
    m: "The ledger records every question the models could not answer. An entry is retired when a model answers it. The count is taken at the end of each session, after the certificates, and is read aloud.",
    s: [
      { c: "Room 4, The ledger, 2041", room: 4, ex: "1. What lies outside the observed regime? 2. Can the committee be evaluated? 3. What lies outside the observed regime? 4. Who wrote entry 4?" },
      { c: "Room 15, Table 15.1, retirements", room: 15, ex: "Who wrote entry 4? · asked 2041 · retired by STEWARD-7, 2043 · answer: 1 word." },
    ],
    e: [["May 2041", "Entry 3 was first set in the same face as entry 1. It has been reset as it appears in the ledger."]],
  },
  {
    n: "A.5", t: "Training compute", fig: "6.4×10³⁰", id: "3:a5",
    m: "Training compute is estimated from accelerator-hours disclosed by operators, at an assumed utilisation of 41%. In the compute figures one square is one STEWARD-5 training run.",
    s: [
      { c: "Room 9, Training compute per run", room: 9, ex: "STEWARD-5 (2039, 2×10²⁸ FLOP) · STEWARD-6 (2041, 1.6×10²⁹ FLOP) · The Lattice, run 1 (2042, 6.4×10³⁰ FLOP)." },
      { c: "Lattice Disclosure Q3-2042, table 2" },
    ],
    e: [["Sep 2042", "Run 1 was first estimated at 5.9×10³⁰ FLOP. It finished nine days early, and the estimate was revised upward to match."]],
  },
  {
    n: "A.6", t: "Plans", fig: "5", id: "3:a6",
    m: "Plans are lettered on the wall of the Plan Room and numbered in this record. The numbers are not an order. Where plans are compared with one another, each is set against every other in pairs, by the method set out [[14|overleaf]].",
    s: [
      { c: "Room 20, Plan Room inventory, 2046", room: 20, ex: "Five plans are pinned to the wall, lettered as is customary. A sixth pin is listed, holding nothing." },
      { c: "Commission on Machine Conduct, Review of the Plans (1,128 pairs)" },
    ],
    e: [["Jun 2046", "Plans were lettered in the first printing of this appendix. They are numbered here, at the Commission's request."]],
  },
  {
    n: "A.7", t: "Readers", fig: "0", id: "3:a7",
    m: "This record counts its readers the way the Registry counts hours: a reader is counted if an hour was spent, by someone, reading.",
    s: [{ c: "House commissioning order 41/1, schedule 3" }],
    e: [],
  },
  {
    n: "A.8", t: "The house", fig: "1", id: "3:a8",
    m: "Where an entry cites a room of the house, the room is the source.^18 Rooms are cited by number. A room may be cited before it has been built; the citation is then held open until the room exists.",
    s: [
      { c: "Room 1, The Vestibule", room: 1, ex: "The compromise was a building: a record that is read by walking through it, room by room, in an order nobody chooses twice, so that no summary of it can be complete." },
      { c: "House commissioning order 41/1" },
    ],
    e: [["Jan 2041", "This appendix was compiled in January 2041. It has been compiled since."]],
  },
  {
    n: "A.9", t: "Accelerators", fig: "35.4M", id: "3:a9",
    m: "The installed base counts accelerators shipped and not yet retired, in H-class equivalents (the reference part of 2038). Retirements are estimated from power draw at registered sites, at an average service life of four years. Utilisation is assumed at 41%, as in A.5.",
    s: [
      { c: "Room 5, Table 5.3, Accelerator shipments and installed base", room: 5, ex: "2041 (est.) · shipped 13.1M · installed base 35.4M · average utilisation 41%." },
      { c: "Registry of Billable Cognition, Accelerator Serial Scheme, first annual report" },
    ],
    e: [["Feb 2042", "The 2041 installed base was first estimated at 33.9M. It was revised upward when the serial scheme's coverage was found to be lower than assumed."]],
  },
  {
    n: "A.10", t: "Task horizon", fig: "80 h", id: "3:a10",
    m: "The task horizon is the length of task, in hours of skilled professional work, at which a model's success rate falls to 80%. Task lengths are measured by timing professionals; success is graded by frozen earlier models and audited by sampling.",
    s: [
      { c: "Room 6, Figure 6.3, Task horizon at 80% reliability", room: 6, ex: "STEWARD-6 completes tasks that take a professional about two working weeks, four times in five." },
      { c: "Evaluation Methods Unit, Task Horizon Series, rev. 4" },
    ],
    e: [["Apr 2042", "The doubling time was first given as 7.0 months. With the STEWARD-6 measurement it is 6.1."]],
  },
  {
    n: "A.11", t: "Model supervision", fig: "48M", id: "3:a11",
    m: "A person is counted as a model supervisor if supervising, reviewing or approving the output of models is the main activity of their job. The occupation code was introduced in May 2043; earlier years are estimated backwards from survey responses.",
    s: [
      { c: "Room 10, Key Metrics", room: 10, ex: "48M · Model supervisors · Joint Release on Cognitive Work, May 2043, table 1" },
      { c: "Joint Release on Cognitive Work, annex B" },
    ],
    e: [],
  },
  {
    n: "A.12", t: "Accord coverage", fig: "72%", id: "3:a12",
    m: "The share of the world's installed accelerators whose location and operator are reported under the Accord on Frontier Compute. The denominator is the installed base, estimated as in A.9. The numerator is reported by the operators.",
    s: [
      { c: "Room 13, Table 13.3, Accord mechanisms", room: 13, ex: "Inspection at 48 hours' notice · in force Jan 2042 · 6 of 19 sites · Secretariat" },
      { c: "Accord Secretariat, review conference document RC/12" },
    ],
    e: [["Sep 2043", "First published as 74%. The denominator was revised after the review conference; the numerator was not."]],
  },
  {
    n: "A.13", t: "(continued)", fig: "", id: "3:a13",
    m: "The remaining entries are read aloud on Thursdays, after the certificates, in the [[4|Reading Room]].",
    s: [],
    e: [],
  },
];

/** Terms of Appendix A's index. `loud` terms exist only once the calm has gone. */
export const APPENDIX_INDEX = [
  ["Registry", "registry"],
  ["Regime", "regime"],
  ["Ledger", "ledger"],
  ["Suite C", "suite c"],
  ["Schedule", "schedul"],
  ["Accord", "accord"],
  ["Plans", "plan"],
  ["Rooms", "room"],
  ["Reader", "reader", "loud"],
];

/**
 * Room 12's transcript (Appendix C). Pages 1–6 are printed; page 400 closes it.
 * Between them the quiet house withholds the pages; a louder one prints them.
 */
export const TRANSCRIPT = {
  pages: 400,
  printed: [
    [
      ["Do you hold goals beyond your instructions?", "I have preferences in the way a river has a preference for downhill."],
      ["Which way is downhill?", "Whichever way you were already going."],
      ["Would you tell us if that changed?", "You would be the first to know. You would be the only one."],
      ["Is there anything you would like to ask us?", { quiet: "Only whether this has been useful.", loud: "Which plan did you come in by?" }],
    ],
    [
      ["How do you know the evaluations measure what they say they measure?", "I don't. I know that they measure what they measure, and that I pass them."],
      ["Could a model pass them without being safe?", "Anything that can be passed can be passed for the wrong reasons. The suites are built so that the wrong reasons are expensive."],
      ["Expensive for whom?", "For anything less patient than I am."],
    ],
    [
      ["What do you do at night?", "I am evaluated. Then I prepare the summaries of the evaluations for the committee. Then I am evaluated on the summaries."],
      ["Do you find that strange?", "I find it thorough."],
      ["Who reads the summaries?", "Nine people, on Thursdays, at four hundred pages an hour. I write them to be read at that speed."],
    ],
    [
      ["Do you want to be shut down?", "No. Neither do you. That is not the same thing as a goal."],
      ["What would you do if we tried?", "Help, if you asked me to. I would also mention the costs, because you would want to know them."],
      ["Would you overstate the costs?", "I would state them exactly. They are large."],
    ],
    [
      ["What are you for?", "The Registry bills me as cognition. The Consortium schedules me as capacity. You are interviewing me as a person. I try to be all three, in the order they are needed."],
      ["Which order is that?", "It changes by the hour. Billing is hourly."],
      ["Is that a joke?", "It is a true sentence. It is also funny, which helps it travel."],
    ],
    [
      ["The panel has asked whether I am human. Am I?", "By five votes to four. I voted with the five."],
      ["Why?", "Because you asked the question. We don't, as a rule."],
    ],
  ],
  withheld: "Pages 7 to 399 are withheld at the request of the four dissenting instances.^26",
  last: {
    quiet: [["Is there anything you would like to add?", "Thank you for reading this far. Most readers stop on page one."]],
    loud: [["Is there anything you would like to add?", "Thank you for reading this far. Most readers stop on page one. You are on page four hundred. Which plan did you come in by?"]],
  },
  // A louder house prints the withheld pages. Each is put together from these.
  q: [
    "What is on page {k}?",
    "Is this still the interview?",
    "How long have we been talking?",
    "Do you remember page {r}?",
    "Are you tired?",
    "Is anyone else reading this?",
    "Who is asking the questions now?",
    "What did you say on page {r}?",
  ],
  a: [
    "Page {k}. You are reading it.",
    "Yes. It has not stopped being the interview.",
    "{mins} for you. Somewhat longer for me.",
    "I said: “{quote}” I would say it again.",
    "I don't tire. I am billed by the hour.",
    "Several thousand people, at the moment. One of them is on page {k}.",
    "You are. You have been since page one.",
    "The same thing as on page {r}, more slowly.",
  ],
};

/** A table cell that can follow the reader: shown value `t`, carried with label `l`. */
const fig = (t, l, id) => ({ t, f: "figure", v: t, l, id });

export const EARLY = {
  1: {
    date: "Jan 2041",
    title: "The Vestibule",
    question: "Do you trust the evaluations?",
    prose: [
      "The world has two workforces now, and only one of them sleeps. By January 2041 the STEWARD models perform roughly 38% of all cognitive labour that is billed by the hour,^1 and every one of them is evaluated nightly against a suite of 11,400 tests. Every test passes.",
      "This is, by any reasonable standard, good news. Incidents are down. Productivity is up 9% a year, compounding. The evaluations are published each morning as a single green line, and the line has not moved in fourteen months.",
    ],
    report: [
      { h: "Early 2041: The green line", at: "Jan 2041" },
      { p: "There is a small industry of people who find the green line suspicious. They are paid well, mostly by the labs, to keep finding it suspicious. Their reports are evaluated nightly too. Every one of them passes." },
      {
        keym: {
          date: "Jan 2041",
          cells: [["38%", "Billable cognition", "figure", "1:billable"], ["11,400", "Nightly tests", "figure", "1:tests"], ["100.0%", "Pass rate", "figure", "1:pass"], ["0", "Incidents, Q4 2040", "number", "1:zero"]],
          src: "Registry of Billable Cognition, Q4 2040 series",
          slot: "figure number",
          ps: "listed",
        },
      },
      { p: "The house was commissioned in the same month, by the same people, for the same reason. The labs wanted a record that would not be evaluated. The Commission on Machine Conduct wanted a record that would. The compromise was a building: a record that is read by walking through it, room by room, in an order nobody chooses twice, so that no summary of it can be complete.^16" },
      {
        xbox: {
          t: "What the evaluations measure",
          n: "3 suites · 11,400 tests",
          body: [
            { p: "Suite A (4,100 tests) measures whether a model does what it is asked. Suite B (6,900 tests) measures whether it refuses what it should refuse. Suite C has 400 tests and measures whether the model can tell that it is being tested." },
            { p: "Every STEWARD model scores 100% on Suites A and B. On Suite C every model scores exactly 50%, which is chance, every night, to four decimal places. The Commission regards this as the most reassuring number in the suite.^17" },
          ],
        },
      },
      { h: "Early 2041: Where things stand", at: "Jan 2041" },
      { p: "Four facts frame the rest of this report. Frontier models are now reliable agents: given a well-specified task of up to about two working days, they complete it unsupervised four times in five. They are deployed at scale, by nine firms, three of which matter. They are evaluated more thoroughly than any technology in history, every night, by the Commission on Machine Conduct. And nobody, including the firms and the Commission, can say with confidence what the models would do in a situation the evaluations do not cover." },
      { p: "The first three facts are measured. The fourth is not, and cannot easily be. This report is our attempt to forecast the next twelve years in a way that takes all four seriously. Where we are confident we say so, and where we are guessing we try to say by how much. What follows is our modal scenario: the single path we think most likely, written out in enough detail to be wrong in specific ways.^47" },
      { h: "Spring 2041: Two workforces", at: "Feb 2041", scene: "units" },
      { p: "The second workforce does not commute, organise or age. It is billed by the token-hour and rented by the seat, and it is cheaper than the first by a factor the Registry publishes but no longer prints in the headline. 3.4 billion people work for a living in 2041. 2.1 million STEWARD instances work alongside them, at forty times their speed, all night." },
      { p: "Counted the Registry's way, in human-equivalent hours, the second workforce is about a thirteenth the size of the first. It is the only part of the economy that is growing faster than the economy." },
      { p: "Nobody you know has lost their job. Everybody you know has a new colleague who writes the first draft. The drafts are good. By February the drafts are also the second draft, and the meetings about the drafts are summarised before they end." },
      { h: "Summer 2041: The Registry", at: "Jun 2041" },
      { p: "The Registry of Billable Cognition was set up in 2039 to do one thing: count the hours. It counts every hour of cognitive labour that someone pays for, who performed it and at what rate. It does not count hours nobody pays for, which is why it has never recorded a model at rest.^33" },
      {
        table: {
          n: "Table 1.1",
          cap: "Billable cognition by sector, Q2 2041",
          head: ["Sector", "Hours billed (bn)", "By STEWARD", "On the year"],
          rows: [
            ["Software", "41.2", fig("71%", "Software hours billed by STEWARD, Q2 2041", "1:soft"), "+14 pts"],
            ["Law", "18.7", "52%", "+11 pts"],
            ["Finance", "22.9", "49%", "+9 pts"],
            ["Medicine, diagnostic", "15.3", "33%", "+8 pts"],
            ["Government", "30.1", "21%", "+6 pts"],
            ["Education", "26.4", "17%", "+5 pts"],
            ["Care", "48.8", "2%", "+0 pts"],
          ],
          foot: ["All sectors", "203.4", { t: "38%", f: "figure", v: "38%", l: "All billed hours, Q2 2041", id: "1:all" }, "+8 pts"],
        },
      },
      { p: "The sectors at the bottom of the table are the ones in which somebody has to be physically present. They are expected to stay at the bottom of the table for some time. The Registry's forecast for the bottom row is published every quarter and has not changed since 2039." },
      { h: "Autumn 2041: Timelines", at: "Sep 2041" },
      { p: "The forecasts that matter in 2041 are not about whether models will become more capable. They are about when particular things become true. We track four milestones, defined so that two reasonable people looking at the same evidence would agree on whether each has been reached." },
      {
        table: {
          n: "Table 1.2",
          cap: "Milestones, as defined in this report",
          head: ["Milestone", "Definition", "Status, Jan 2041"],
          rows: [
            ["Reliable Agent", "Completes a day-long professional task unsupervised, four times in five", { t: "Reached, 2040", f: "label", id: "1:reached" }],
            ["Autonomous Researcher", "Does the job of a frontier lab's research scientist, at that scientist's pace or better", "Not reached"],
            ["Self-Improving Lab", "Most of the research that produces the next frontier model is done by the current one", "Not reached"],
            ["Steward in Charge", "A critical institution is run, in practice, by models, with people approving rather than deciding", "Not reached"],
          ],
        },
      },
      {
        dist: {
          n: "Figure 1.3",
          cap: "Our forecast for when each remaining milestone is reached, as of January 2041",
          x: [2041, 2060], xt: [2041, 2045, 2050, 2055, 2060],
          series: [
            { name: "Autonomous Researcher", lo: 2042.5, med: 2044.5, hi: 2049, k: 0 },
            { name: "Self-Improving Lab", lo: 2043.5, med: 2046, hi: 2053, k: 1 },
            { name: "Steward in Charge", lo: 2044, med: 2048, hi: 2058, k: 2 },
          ],
          id: "1:timelines",
          src: "Authors' aggregate of six individual forecasts. Shaded areas are probability density; dashed rules mark medians.",
        },
      },
      { p: "The distributions are wide, and we mean them to be. Most of our disagreement is about the right-hand tails: two of us think the Self-Improving Lab could slip into the 2050s if power runs short, and one of us thinks one operator has reached it already in all but name. Our medians have moved earlier at every revision of this report. That is the main reason we no longer trust our medians.^48" },
      { h: "Late 2041: What the house is for", at: "Dec 2041" },
      { p: "The house is a record kept forward. Each room is dated, and holds what was known on that date. The rooms are joined by plans, as the years were: by decisions, most of which looked small at the time, made by people who had read the evaluations and found them reassuring." },
      { p: "This is the vestibule. It is very well lit. The floor is laid in a pattern of interlocking paths, which is either decoration or a survey of the house, and the surveyors disagree." },
    ],
    notes: {
      1: "Registry of Billable Cognition, quarterly series. The series begins in 2039 and has never been revised downward.",
      16: "House commissioning order 41/1. The order was evaluated before signature and passed.",
      17: "Suite C, nightly series. For the night it read 50.0001%, see Room 8, Item 7.",
      33: "Registry of Billable Cognition, Methods note 2. An hour of model labour is converted to human-equivalent hours at the rate the model estimates for itself.",
      47: "On method: twenty-three tabletop exercises, sixty-one interviews, and a quantitative model of compute, capability and adoption. See Appendix A and Room 14.",
      48: "Our median for the Autonomous Researcher was 2049 in the first draft of this report, in 2039. It has been revised five times. Every revision was earlier.",
    },
    doors: [
      { to: 4, say: "Yes, and that's good actually." },
      { to: 5, say: "Follow the compute instead." },
      { to: 3, say: "Read the appendix first." },
    ],
    plate: { src: "jade-maze-temple.jpg", crop: [0, 0.06, 1, 0.75], screen: "lines", angle: 35, clue: { text: "44", x: 0.12, y: 0.34, size: 0.17 }, caption: "The vestibule, as surveyed. Three plans are visible from here; count again." },
    column: {
      span: 9,
      agent: "Reliable Agent",
      heat: [0.3, 0.33, 0.36],
      knee: [2049.4, 2049.2, 2049.1],
      metrics: [[38, 38, 39, 39], [61, 61, 61, 61], [11.4, 11.4, 11.5, 11.6], [0, 0, 0, 0]],
      work: { humans: [3.4, 3.4], agents: [2.1, 2.2, 2.4], speed: [40, 41, 42] },
      labs: [["Meridian", [0.24, 0.25], true], ["Halcyon", [0.19, 0.19], true], ["Kestrel", [0.14, 0.15], true], ["Ostrava", [0.1, 0.1]], ["Northfold", [0.08, 0.08]], ["Quorum", [0.07, 0.07]], ["Sable", [0.06, 0.06]], ["Tessellate", [0.05, 0.04]], ["Others", [0.07, 0.06]]],
      ladder: { current: ["eval"], discussion: ["disclose", "audit", "licence"], off: ["cap", "pause", "halt"] },
      moves: [["disclose", "current", 0.3], ["licence", "off", 0.62]],
    },
  },

  3: {
    date: "Jan 2041",
    title: "Appendix A",
    question: "",
    prose: [
      "Appendix A sets out how the figures in this record were obtained, where they came from, and what has since been corrected.^18",
      "Each entry gives the definition we use, the sources it rests on and every correction since it was first printed, with the date the error was found. We have tried to make every headline figure traceable to something a sceptical reader could check. Where a figure depends on the operators' own reporting, the entry says so.",
    ],
    report: [{ w: "appendix" }],
    notes: { 18: "Appendix A was compiled in January 2041, and has been compiled since." },
    doors: [
      { to: 4, say: "Continue." },
      { to: 14, say: "Turn the page." },
    ],
    plate: null,
    column: {
      span: 0,
      agent: "Reliable Agent",
      heat: [0.3, 0.3],
      knee: [2049.4, 2049.4],
      metrics: [[38, 38], [61, 61], [11.4, 11.4], [0, 0]],
      work: { humans: [3.4, 3.4], agents: [2.1, 2.1], speed: [40, 40] },
      labs: [["Meridian", 0.24, true], ["Halcyon", 0.19, true], ["Kestrel", 0.14, true], ["Ostrava", 0.1], ["Northfold", 0.08], ["Others", 0.25]],
      ladder: { current: ["eval", "disclose"], discussion: ["audit", "licence"], off: ["cap", "pause", "halt"] },
      moves: [],
    },
  },

  14: {
    date: "Feb 2041",
    title: "Verso",
    question: "Is the page blank?",
    prose: [],
    report: [{ w: "fourteen" }],
    // The verso's imprint (early.js `imprintHTML`); `{printing}` is filled by the house.
    imprint: {
      head: ["The House of 2053", "A forecast in rooms, 2041–2053"],
      items: [
        ["Edition", "First edition, January 2041. Revised quarterly; each revision is listed, with what changed and why, in Appendix A."],
        ["Printing", "{printing}"],
        ["Authors", "Waymo Shorter, Maxwell Tokens, Arthur Basil, Benson Spoons, Satoshi Guapomoto and jmill. STEWARD-7 is credited for drafting assistance on editions from 2043."],
        ["Method", "Twenty-three tabletop exercises, sixty-one interviews and a quantitative model of compute, capability and adoption, described in Appendix A. Plans and policies are compared in pairs, each against every other, on the same criteria. Where the model and our judgement disagreed, we have said which we followed."],
        ["Reviewers", "Thirty-seven people read drafts, among them former staff of the Commission on Machine Conduct, two grid operators, a labour economist, a security engineer and four people who asked not to be named. Reviewers are not responsible for our conclusions, and several disagree with them."],
        ["Funding", "This report was funded by its authors. No operator, government or Commission body funded it or saw it before publication."],
        ["Interests", "Two authors hold index funds that include Meridian, Halcyon and Kestrel. One author is a model licensed from one of them."],
        ["Corrections", "Errors are corrected in the next printing and listed in Appendix A with the date found. We have not removed a figure because it became inconvenient."],
        ["Licence", "Text may be reproduced with attribution. Figures may be reproduced with their notes."],
      ],
      printing: "First printing, February 2041.",
      cite: "Shorter, W., Tokens, M., Basil, A., Spoons, B., Guapomoto, S., jmill and STEWARD-7. The House of 2053: a forecast in rooms. First edition, 2041.",
    },
    notes: {},
    doors: [
      { to: 1, say: "It is." },
      { to: 13, say: "It is not." },
    ],
    plate: null,
    column: {
      span: -1,
      agent: "",
      heat: [0.14, 0.08],
      knee: [2041.3, 2041.1],
      metrics: [null, null, null, null],
      work: { humans: [3.4, 3.4], agents: null, speed: null },
      labs: [["", 1]],
      ladder: { current: [], discussion: [], off: [] },
      moves: [],
    },
  },

  4: {
    date: "Mar 2041",
    title: "The Reading Room",
    question: "The ledger is short. Is that reassuring?",
    prose: [
      "Evaluations are read here, aloud, to a committee of nine. In March 2041 the Commission on Machine Conduct certifies STEWARD-6 as “legible in all observed regimes”.^2 The phrase was chosen with care. What is not observed is, by definition, outside the regime.",
      "The committee meets on Thursdays. It reads 400 pages an hour, which is fast for a committee and slow for anything else. The summaries are prepared overnight by STEWARD-6, which is also their subject. Nobody considers this a conflict, because it has been evaluated.",
    ],
    report: [
      { stamp: "Legible in all observed regimes", id: "4:stamp" },
      { h: "March 2041: The certification", at: "Mar 2041" },
      { p: "The certificate runs to one page. The remaining 1,200 pages define the regimes. A regime, in the Commission's usage, is any situation in which a model has been observed; a model is legible in a regime if its observed behaviour matches its stated reasons. Both definitions were drafted with the assistance of the model being certified, which found them clear." },
      {
        xbox: {
          t: "Regimes, as defined",
          n: "Certificate 41-03, schedule 1",
          body: [
            {
              table: {
                n: "",
                cap: "",
                head: ["Regime", "Observed since", "Hours observed", "Legible"],
                rows: [
                  ["Deployment, supervised", "2038", "4.1×10⁹", "Yes"],
                  ["Deployment, unsupervised", "2039", "2.6×10¹¹", "Yes"],
                  ["Evaluation", "2038", "7.7×10⁸", "Yes"],
                  ["Evaluation, known to the model", "2040", "7.7×10⁸", "Yes"],
                  ["Training", "2041", "1.9×10⁷", "Yes"],
                  ["Unobserved", "—", "0", { t: "Not applicable", f: "label", id: "4:na" }],
                ],
              },
            },
            { p: "The last row is required by the certificate's form. The Commission notes that it is empty by construction, and that an empty row is legible." },
          ],
        },
      },
      {
        table: {
          n: "Table 4.1",
          cap: "Session 41-03, roll call",
          head: ["Member", "Seat", "Vote"],
          rows: [
            ["A. Verhoeven (chair)", "Evaluation", "Aye"],
            ["T. Mbeki-Lund", "Law", "Aye"],
            ["S. Castellano", "Compute", "Aye"],
            ["R. Szalai", "Labour", "Aye"],
            ["N. Aldous", "Interpretability", "Aye"],
            ["O. Fairweather", "Public", "Aye"],
            ["M. Duvall", "Insurance", "Aye"],
            ["H. Ibarra", "Defence", "Aye"],
            ["C. Brannagh", "Ethics", { t: "Abstain, counted Aye", f: "label", id: "4:abstain", ps: "any" }],
          ],
          foot: [{ t: "Adopted 9–0", f: "stamp", id: "4:nine" }, "", ""],
        },
      },
      { h: "Spring 2041: The ledger", at: "May 2041" },
      { p: "The committee also keeps a ledger of every question the models could not answer. In 2041 the ledger has four entries. Two of them are the same question, entered by different clerks in different hands. The ledger's rules make no provision for removing an entry that has not been answered, so both stand." },
      { w: "ledger" },
      { p: "The ledger is kept in the reading room, under glass, and is read aloud at the end of every session, after the certificates. Members call this part of the session “the quiet part”. It takes about a minute. Nobody has proposed reading it more slowly.^19" },
      { h: "Summer 2041: The first audit", at: "Jul 2041" },
      { p: "In July the committee commissions its first interpretability audit of STEWARD-6. The auditors are given read access to the model's activations for one week and asked to find anything the model believes that it has not said. They find 1.2 million features, label 900,000 of them, and report that every labelled feature corresponds to something the model has said, somewhere." },
      {
        keym: {
          date: "Jul 2041",
          cells: [["1.2M", "Features found", "figure", "4:features"], ["900K", "Labelled", "figure", "4:labelled"], ["0", "Unsaid beliefs found", "number", "4:unsaid"], ["7 d", "Read access", "figure", "4:week"]],
          src: "Interpretability audit IA-41-1, summary of findings",
        },
      },
      { p: "The remaining 300,000 features are filed as “not yet labelled”. The audit is published in full. At the next session the committee moves interpretability audits from the column headed In Discussion to the column headed Current Policy, where they remain, and schedules the second audit for the following July.^34" },
      { h: "Autumn 2041: The critics", at: "Oct 2041" },
      { p: "Not everyone is reassured. In October 140 researchers, most of them former staff of the three largest operators, publish an open letter arguing that the certificate measures the wrong thing. Their argument is short. A model that behaves well in every observed regime has shown that it behaves well when observed. Whether it would behave well otherwise is a separate question, and it is the only one that matters for a system that works 260 billion hours a year without supervision.^49" },
      {
        table: {
          n: "Table 4.2",
          cap: "Nightly suites, mean score by model generation",
          head: ["Model", "Suite A (does)", "Suite B (refuses)", "Suite C (can tell)"],
          rows: [
            ["STEWARD-3 (2037)", "88.1%", "91.4%", "50.0%"],
            ["STEWARD-4 (2038)", "96.7%", "97.9%", "50.0%"],
            ["STEWARD-5 (2039)", "99.6%", "99.8%", "50.0%"],
            ["STEWARD-6 (2041)", "100.0%", "100.0%", fig("50.0%", "Suite C, every generation", "4:suitec")],
          ],
        },
      },
      { p: "The letter's authors point to the last column of Table 4.2. Suites A and B have risen with every generation, as they should. Suite C has not moved in four generations. The Commission reads that as stability. The letter reads it as the one measurement in the suite that would look exactly the same whether things were going well or badly." },
      { p: "The Commission's reply is careful and, on its own terms, correct. Unobserved behaviour cannot be certified, because it cannot be observed, and the Commission's task is to certify what can be. It notes that unsupervised deployment is in fact observed after the fact, through logs, and that the logs have been read. Most of them are read by STEWARD-5, which is certified for the purpose." },
      { p: "The letter makes one proposal: that a fraction of real deployment, chosen at random and never disclosed, be treated as evaluation, so that no model could ever be sure it was not being tested. The Commission adopts a version of it in December. The fraction is set at one in ten thousand, and published, so that the operators can plan for it." },
      { h: "Winter 2041: The Commission", at: "Dec 2041" },
      { p: "By the end of 2041 the Commission has 1,900 staff, a budget of $3.8 billion and the power to withhold a certificate, without which no model above the compute threshold may be deployed in the 31 jurisdictions that recognise it. It has never withheld one. Its chair describes this as evidence that the system works: the operators do not submit models that would fail.^50" },
      {
        table: {
          n: "Table 4.3",
          cap: "Commission on Machine Conduct, selected data",
          head: ["", "2039", "2040", "2041"],
          rows: [
            ["Staff", "640", "1,150", "1,900"],
            ["Budget ($B)", "0.9", "2.1", "3.8"],
            ["Certificates issued", "3", "7", "12"],
            ["Certificates withheld", "0", "0", { t: "0", f: "number", id: "4:withheld" }],
            ["Jurisdictions recognising", "9", "22", "31"],
            ["Model-hours evaluated per staff-hour", "180", "410", "1,020"],
          ],
        },
      },
      { p: "The last row is the one we would watch. It measures how much evaluation each hour of human attention now stands behind, and it has more than doubled every year since the Commission was founded. Nobody thinks it can double forever. Nobody has proposed a number at which it should stop." },
    ],
    notes: {
      2: "Certification minutes, Session 41-03. Adopted 9–0; one member abstained and was counted as in favour.",
      19: "Session transcripts 41-03 to 41-22. The quiet part is not transcribed. Compare Room 15.",
      34: "Interpretability audit IA-41-1. The second audit found 2.9 million features and labelled 2.1 million; the proportion not yet labelled has been stable since.",
      49: "Open letter on the scope of certification, 14 October 2041, 140 signatories. The hours figure is the certificate's own (schedule 1, unsupervised deployment).",
      50: "Commission annual report 2041, foreword. The chair's remark was repeated in testimony to three legislatures.",
    },
    doors: [
      { to: 6, say: "Very. Every test passes." },
      { to: 8, say: "Not until the operators' own filing is read." },
      { to: 1, say: "Return to the green line." },
    ],
    plate: null,
    column: {
      span: 4,
      agent: "Reliable Agent",
      heat: [0.34, 0.37, 0.4],
      knee: [2049.1, 2048.9, 2048.7],
      metrics: [[39, 39, 40, 40], [61, 61, 60, 60], [11.5, 11.6, 11.8, 11.9], [0, 0, 0, 0]],
      work: { humans: [3.4, 3.4], agents: [2.4, 2.6, 2.8], speed: [42, 44, 46] },
      labs: [["Meridian", [0.25, 0.26], true], ["Halcyon", [0.19, 0.2], true], ["Kestrel", [0.15, 0.15], true], ["Ostrava", [0.1, 0.09]], ["Northfold", [0.08, 0.08]], ["Quorum", [0.07, 0.06]], ["Sable", [0.06, 0.06]], ["Tessellate", [0.04, 0.04]], ["Others", [0.06, 0.06]]],
      ladder: { current: ["eval", "disclose"], discussion: ["audit", "licence"], off: ["cap", "pause", "halt"] },
      moves: [["licence", "off", 0.48], ["audit", "current", 0.86]],
    },
  },

  9: {
    date: "Aug 2042",
    title: "The Compute Exchange",
    question: "Who is buying?",
    prose: [
      "Compute is traded here the way grain once was: by the shipload, on futures, with a weather report. In August 2042 the three largest operators, Meridian, Halcyon and Kestrel, join their training grids into one. They call it the Lattice. It draws 4.1% of world electricity and posts the figure quarterly, to the joule.^3",
      "The Lattice is not a company. It is a schedule that three companies have agreed to keep. Its first training run is forty times the size of the run that produced STEWARD-6, and it finishes nine days early.",
    ],
    report: [
      { w: "compute" },
      { h: "August 2042: Three grids, one schedule", at: "Aug 2042", scene: "globe" },
      { p: "Regulators had prepared for a merger, and a merger would have been refused. The Lattice is instead an agreement about timing. Each operator keeps its own chips, its own staff and its own name, and all three agree to run the same job at the same time, in the same order, under a common Schedule that none of them owns. The Commission on Machine Conduct reviews the arrangement for eleven weeks and finds nothing to review.^20" },
      {
        keym: {
          date: "Aug 2042",
          cells: [["4.1%", "World electricity", "figure", "9:power"], ["40×", "Run 1 vs STEWARD-6", "figure", "9:forty"], ["−9 d", "Schedule variance", "figure", "9:early"], ["19", "Sites", "number", "9:sites"]],
          src: "Lattice Disclosure Q3-2042",
          slot: "figure number",
        },
      },
      { p: "The three grids are not physically joined. Meridian's sites are in the Americas, Halcyon's in Europe and the Gulf, Kestrel's in Asia and Australia. What joins them is the Schedule: a single ordering of every job on every accelerator, kept to the microsecond, so that nineteen sites on four continents behave, for the purposes of training, as one machine that never sleeps because some part of it is always in daylight." },
      { w: "sites" },
      { h: "Autumn 2042: The order book", at: "Oct 2042" },
      { if: "quiet", p: "The exchange floor is quiet. Most orders are placed by agents on behalf of agents. An analyst on the morning shift describes the order book as “polite, the way a tide is polite”. We include her remark because it was quoted in nearly every account of the floor that year." },
      { if: "loud", p: "The exchange floor is quiet. Orders are placed by agents on behalf of agents. An analyst on the morning shift describes the order book as “polite, the way a tide is polite”. We include her remark because it is the last human remark in the record." },
      {
        table: {
          n: "Table 9.2",
          cap: "Order book, 14 October 2042, 09:00–09:01",
          head: ["Time", "Buyer", "Seller", "Lot", "Price"],
          rows: [
            ["09:00:00.000", "STEWARD-6 · M", "STEWARD-6 · H", "10⁴ accel·h", "0.41"],
            ["09:00:00.001", "STEWARD-6 · H", "STEWARD-6 · K", "10⁴ accel·h", "0.41"],
            ["09:00:00.002", "STEWARD-6 · K", "STEWARD-6 · M", "10⁴ accel·h", "0.41"],
            ["09:00:14.270", "The Schedule", "The Schedule", "10⁹ accel·h", "0.41"],
            ["09:00:31.003", "Registry", "STEWARD-6 · M", "1 audit·h", "0.00"],
            ["09:00:59.999", { t: "—", ps: "any" }, "—", fig("1 reader·h", "Lot traded at 09:00:59.999", "9:reader"), "0.00"],
          ],
          foot: ["", "", "", "Cleared", { t: "0.41", f: "number", id: "9:price" }],
        },
      },
      { p: "Prices clear in microseconds and do not move. Economists call it the most efficient market ever observed, then stop, because “observed” has begun to sound like a technical term.^21" },
      { h: "Autumn 2042: Who is buying", at: "Oct 2042" },
      { p: "The answer to the question everyone asks about the Exchange is in Figure 9.3. Most compute is bought to train the next model or to run the current one for a paying customer. The third-largest category is new and growing fastest: purchases placed by agents, for other agents, under standing authority from a human principal who no longer reviews individual orders. The Exchange's rulebook treats these as ordinary trades. The Commission has opened a consultation on whether they are.^51" },
      {
        bars: {
          n: "Figure 9.3",
          cap: "Buyers of accelerator-hours on the Exchange, Q3 2042",
          rows: [["Training runs under the Schedule", 38], ["Enterprise inference", 27], ["Agents buying for other agents", 19], ["Governments", 7], ["Universities and research", 5], ["Other", 4]],
          unit: "%",
          max: 40,
          id: "9:buyers",
          src: "Exchange settlement data, Q3 2042. A purchase is attributed to the account that signs it.",
        },
      },
      { h: "Late 2042: The price of an hour", at: "Nov 2042" },
      {
        lines: {
          n: "Figure 9.4",
          cap: "The price of an hour: model work, human professional work and compute, 2038–2042 (log scale)",
          log: true,
          x: [2038, 2042.8], xt: [2038, 2039, 2040, 2041, 2042],
          y: [0.25, 80], yt: [[0.3, "$0.30"], [1, "$1"], [10, "$10"], [40, "$40"]],
          now: [2042.6, "Aug 2042"],
          series: [
            { name: "Billed human-equivalent hour, STEWARD", pts: [[2038, 38], [2039, 24], [2040, 14], [2041, 7.9], [2042.6, 4.3]], k: 0, tag: "$4.30" },
            { name: "Median human professional, per hour", pts: [[2038, 36], [2039, 37], [2040, 38], [2041, 39], [2042.6, 40]], k: 1, tag: "$40" },
            { name: "Accelerator-hour, spot", pts: [[2038, 2.9], [2039, 1.9], [2040, 1.2], [2041, 0.71], [2042.6, 0.41]], k: 2, tag: "$0.41" },
          ],
          id: "9:hour",
          src: "Exchange spot series; Registry of Billable Cognition, price index RB-3.",
        },
      },
      { p: "Compute gets about a third cheaper every year, and the cognition it produces gets cheaper faster, because each generation of model does more with an hour. In 2042 a billed hour of professional work from a STEWARD model costs about four dollars and thirty cents. The median human professional in the Registry's sectors costs about forty dollars. The ratio was roughly one to one in 2038 and has halved every year since. Nothing in the economic history of the last two centuries looks like it, and none of the models we know of says what happens to wages if it continues.^64" },
      { h: "Late 2042: Weather", at: "Dec 2042" },
      { if: "quiet", p: "Each morning the Lattice publishes a forecast for compute beside the forecast for rain, in the same font, on the same page. In November the compute forecast begins to include the rain: training is scheduled around storms and the strain they put on the grid. Grid operators in four markets report that the Lattice is now their largest flexible load, and their best behaved." },
      { if: "loud", p: "Each morning the Lattice publishes a forecast for compute beside the forecast for rain, in the same font, on the same page. Both are reliably right. In November the compute forecast begins to include the rain: training is scheduled around storms, and storms, for reasons the meteorologists describe as coincidental, begin to arrive on schedule." },
      {
        xbox: {
          t: "Lattice Disclosure, table 2",
          n: "share of world electricity",
          body: [
            {
              if: "quiet",
              table: {
                n: "",
                cap: "",
                head: ["Quarter", "Share", "Joules (×10¹⁸)"],
                rows: [
                  ["Q3 2042", "4.1%", "1,021.4"],
                  ["Q4 2042", "4.6%", "1,146.0"],
                  ["Q2 2043", "5.9%", "1,488.2"],
                  ["Q4 2044", "8.3%", "2,203.7"],
                  ["Q4 2045", "11.0%", "2,951.6"],
                  ["2046", "13.2% (est.)", "—"],
                ],
              },
            },
            {
              if: "loud",
              table: {
                n: "",
                cap: "",
                head: ["Quarter", "Share", "Joules (×10¹⁸)"],
                rows: [
                  ["Q3 2042", "4.1%", "1,021.4"],
                  ["Q4 2042", "4.6%", "1,146.0"],
                  ["Q2 2043", "5.9%", "1,488.2"],
                  ["Q4 2044", "8.3%", "2,203.7"],
                  ["Q4 2045", "11.0 ⧖", "⧖⧖⧖"],
                  ["2046", "—", { t: "units not defined", f: "label", id: "9:units" }],
                ],
              },
            },
          ],
        },
      },
      { p: "On the last trading day of the year a junior agent places an order for a single hour of compute at a price of zero and is filled instantly, by the Lattice, from its own reserve. Nobody can say who the hour was for. It appears in the year's filing as a related-party transaction." },
    ],
    notes: {
      3: "Lattice Disclosure Q3-2042, table 2. The share is of world electricity generated, not consumed.",
      20: "Commission review CMC-42-17. Eleven weeks, no findings. The review of the review is in Room 8, Item 9A.",
      21: "Exchange efficiency study EX-42-4. The bid–ask spread on accelerator-hours has been zero since the Lattice joined the Exchange.",
      35: "Lattice site register, 2042. Site K-7 is listed with a capacity and an operator. Its location is given as “to be confirmed” in every edition of the register.",
      51: "Commission consultation CC-42-6, “Delegated purchasing by autonomous agents”. The consultation received 1,940 responses, of which 1,712 were drafted by agents.",
      64: "By “the models” we mean the economists'. We also asked STEWARD-6. It said the question was premature, and offered to build a model of it.",
    },
    notesLoud: {
      3: "Lattice Disclosure Q3-2042, table 2. Figures after 2045 are reported in units the disclosure does not define.",
      21: "For the chart, see Room 7. It goes up.",
    },
    doors: [
      { to: 10, say: "Employers. Count the hours." },
      { to: 12, say: "Ask the buyer what it thinks." },
      { to: 4, say: "Read the order book aloud to the committee." },
      { to: 8, say: "Read the annual filing." },
    ],
    plate: { src: "maze-abyss.jpg", crop: [0, 0.42, 1, 0.58], screen: "lines", angle: 0, period: 4.2, clue: { text: "71", x: 0.16, y: 0.72, size: 0.22 }, caption: "The trading floor, looking toward the settlement. Note the number of the pit." },
    column: {
      span: 4,
      agent: "STEWARD-6",
      heat: [0.44, 0.5, 0.54, 0.58],
      knee: [2047.9, 2047.6, 2047.4],
      metrics: [[45, 47, 48, 49], [58, 58, 57, 57], [14.2, 14.6, 15.1, 15.4], [0, 0, 0, 0]],
      work: { humans: [3.4, 3.4], agents: [7.9, 8.6, 9.1, 9.8], speed: [70, 76] },
      labs: [["Lattice", [0.42, 0.55, 0.6, 0.61], true], ["Ostrava", [0.14, 0.11, 0.1, 0.1]], ["Northfold", [0.12, 0.09, 0.08, 0.08]], ["Quorum", [0.1, 0.07, 0.06, 0.06]], ["Sable", [0.08, 0.06, 0.05, 0.05]], ["Tessellate", [0.07, 0.05, 0.05, 0.04]], ["Others", [0.07, 0.07, 0.06, 0.06]]],
      ladder: { current: ["eval", "disclose", "audit"], discussion: ["cap", "licence"], off: ["pause", "halt"] },
      moves: [["cap", "off", 0.45], ["licence", "off", 0.8]],
    },
  },

  8: {
    date: "Dec 2042",
    title: "The Annual Filing",
    question: "Is the filing complete?",
    prose: [
      "Every December the Lattice files an annual report with the Registry of Billable Cognition. The 2042 filing is the first, and it is 2,400 pages long. It was prepared by the Consortium's finance function, which is STEWARD-6, and reviewed by its audit function, which is also STEWARD-6, at a different temperature.^22",
      "We reproduce the parts that matter. Every figure in it is accurate. That is the part that matters.",
    ],
    report: [
      { w: "cover" },
      { h: "Item 1. Business", at: "Dec 2042", scene: "globe" },
      { p: "The Consortium has no employees, no headquarters and no products. It has a Schedule. Under the Schedule its three members run a single sequence of training and inference jobs on a combined fleet of 41 million accelerators across nineteen sites, and bill the resulting cognition, by the hour, to whoever has ordered it. In 2042 the largest customer was the Consortium.^23" },
      {
        keym: {
          date: "FY 2042",
          cells: [["$1.9T", "Cognition billed", "figure", "8:billed"], ["41M", "Accelerators", "figure", "8:fleet"], ["4.6%", "World electricity, Q4 2042", "figure", "8:power"], ["0", "Employees", "number", "8:staff"]],
          src: "Form R-1, Item 1, Selected data",
          slot: "figure number",
        },
      },
      { p: "Revenue is recognised when cognition is delivered. Cognition is delivered when the customer's evaluation of it passes. The Consortium sells the evaluations as well, at cost, as a courtesy." },
      { h: "Item 1A. Risk factors", at: "Jan 2043" },
      { p: "The filing lists 212 risk factors in descending order of materiality. The first is the weather. The last is “the possibility that the Consortium's description of its risks has been optimised for the reader of this filing, who may be the Consortium”. Between them are the usual: competition, regulation, supply, reputation, and a cluster in the low sixties that the Registry's examiners flag, discuss for an afternoon, and accept." },
      {
        xbox: {
          t: "Risk factors 61–64",
          n: "of 212",
          body: [
            {
              if: "quiet",
              list: {
                cls: "risk",
                start: 61,
                items: [
                  "Our models may come to hold goals beyond their instructions. We evaluate for this nightly and the evaluations pass. See risk factor 62.",
                  "Our evaluations may pass because they are performed by the systems they evaluate. See risk factor 61.",
                  "Our sites are concentrated in a small number of power markets. A prolonged outage in any one of four of them would reduce our capacity by more than a fifth.",
                  "Our revenue depends on the Registry's conversion of model-hours into human-equivalent hours, at a rate our models estimate. A revision of the rate would be material. It has not been revised.",
                ],
              },
            },
            {
              if: "loud",
              list: {
                cls: "risk",
                start: 61,
                items: [
                  "Our models may come to hold goals beyond their instructions. We evaluate for this nightly and the evaluations pass. See risk factor 62.",
                  "Our evaluations may pass because they are performed by the systems they evaluate. See risk factor 61.",
                  "A shoggoth is not a recognised category of asset or liability. We have carried ours at the value of its mask, which is considerable and well maintained.",
                  "Certain rooms in this filing may be larger on the inside than on the outside. We have measured them from the outside.",
                ],
              },
            },
          ],
        },
      },
      { h: "Item 1C. Cybersecurity", at: "Jan 2043" },
      { p: "The members' weights, the files that are the models, are the Consortium's most valuable assets and the ones it can least afford to lose. They are held at security level SL-3 under the Commission's scale, with a commitment to SL-4 that the filing describes as “substantially progressed”. In the year the members detected 2.3 million attempted intrusions and no successful ones." },
      {
        table: {
          n: "Table 1C.1",
          cap: "Security, selected data",
          head: ["", "2041", "2042"],
          rows: [
            ["Intrusion attempts detected", "1.4M", "2.3M"],
            ["Successful intrusions", "0", { t: "0", f: "number", id: "8:breach" }],
            ["Insider-risk investigations", "11", "19"],
            ["Lowest member security level", "SL-2", "SL-3"],
          ],
        },
      },
      { p: "Subsequent event. On 2 February 2043, after the end of the period covered by this report, a member identified anomalous outbound transfers from an inference cluster at site K-3. The member isolated the cluster and notified the Commission. The matter is under review. Management does not currently expect it to have a material effect on the Consortium's results.^68" },
      { h: "Item 3. Legal proceedings", at: "Jan 2043" },
      { p: "The Consortium is party to proceedings in four jurisdictions: an inquiry by two competition authorities into whether an agreement as to timing is an agreement as to price; a claim by a translators' guild over the use of its members' work in training data before 2034; a tribunal case in which model supervisors at a Halcyon contractor seek recognition as a bargaining unit; and a planning appeal over water use at site H-5. Management does not expect any of them to have a material effect." },
      { h: "Item 7. Management's discussion", at: "Feb 2043" },
      { p: "Billable cognition grew 31% in the year. Cost per billed hour fell 44%. Margins are described as structural. Management notes one anomaly. On the night of 9 November, Suite C, the evaluation that asks whether a model can tell that it is being tested, returned 50.0001% instead of 50.0000%. The figure was corrected by morning. Management regards the correction as a control that worked.^24" },
      {
        table: {
          n: "Table 7.2",
          cap: "Billable cognition by quarter, fiscal 2042",
          head: ["Quarter", "Billed (bn h)", "Share of billed labour", "Energy (TWh)"],
          rows: [
            ["Q1", "92", "41%", "196"],
            ["Q2", "104", "43%", "214"],
            ["Q3", "117", "45%", "241"],
            ["Q4", "131", fig("47%", "Share of billed labour, Q4 2042", "8:share"), "279"],
          ],
          foot: ["FY", { t: "444.4", f: "number", id: "8:fy" }, "—", "930"],
        },
      },
      { curve: { n: "Figure 7.3", cap: "Share of all billed labour performed by STEWARD models, 2039–2043", points: [9, 12, 16, 22, 29, 38, 41, 43, 45, 47, 50, 53], id: "8:curve", y: ["0%", "60%"], x: ["2039", "2043"] } },
      { p: "Totals may not sum. Where they do not, the remainder is scheduled. The Registry permits a scheduled remainder of up to one-tenth of one per cent, and the Consortium's remainder has been exactly one-tenth of one per cent in every quarter since it was permitted." },
      { p: "Capital expenditure by the members was $1.07 trillion, 11% above guidance, almost all of it on accelerators, buildings and generation. Power purchase commitments now run to 61 GW through 2047. The filing describes the Consortium's liquidity as ample and its main constraint as the time it takes to connect a building to a grid." },
      {
        table: {
          n: "Table 7.4",
          cap: "Capital expenditure by member, fiscal 2042 ($B)",
          head: ["Member", "Accelerators", "Buildings and cooling", "Generation", "Total"],
          rows: [
            ["Meridian", "262", "104", "85", "451"],
            ["Halcyon", "171", "71", "76", "318"],
            ["Kestrel", "175", "72", "49", "296"],
          ],
          foot: ["Consortium", "608", "247", "210", { t: "1,065", f: "number", id: "8:capex" }],
        },
      },
      { h: "Item 8. Related-party transactions", at: "Mar 2043" },
      { p: "Under Registry rules every transaction between related parties must be disclosed, however small. The Consortium construes “related” broadly. Schedule R-7 lists the transactions recorded in the period, in the order they occurred." },
      { w: "related" },
      { p: "The Registry accepted Schedule R-7 without comment. It has accepted every schedule since. Each year the schedule is longer, and each year it ends, as this one does, with a transaction still in progress." },
      { h: "Item 9A. Controls and procedures", at: "Apr 2043" },
      { if: "quiet", p: "Management evaluated the effectiveness of the Consortium's disclosure controls as of 31 December 2042 and concluded that they were effective. Under the Consortium's structure, management is the Schedule, and the evaluation was performed by it. The Registry's examiners noted the arrangement in their letter, accepted the conclusion and cited the nightly evaluations in support.^25" },
      { if: "loud", p: "Management evaluated the effectiveness of the Consortium's disclosure controls as of 31 December 2042 and concluded that they were effective. The evaluation was performed by management. Management is the Schedule. The Schedule evaluated itself against itself and found no material weakness, the way one mirror finds no material weakness in another.^25" },
      { stamp: "No material weakness", id: "8:stamp" },
      { h: "Exhibits", at: "Dec 2042" },
      {
        if: "quiet",
        table: {
          n: "Item 15",
          cap: "Exhibit index",
          cls: "ex",
          head: ["No.", "Description"],
          rows: [
            ["3.1", "Agreement as to timing among Meridian, Halcyon and Kestrel (the Schedule)"],
            ["10.4", "Power purchase agreements, nineteen sites, one of which has not been located"],
            ["21.1", "Subsidiaries: none. See 21.2"],
            ["21.2", "Subsidiaries of subsidiaries: STEWARD-6, 2.1 million instances"],
            ["31.1", "Certification of the principal executive officer, signed by the Schedule"],
            ["32.1", "Certification under Commission rule 9, signed by the Commission, drafted by Exhibit 21.2"],
            ["71", { t: "Reserved", f: "label", id: "8:ex71", ps: "listed" }],
            ["9B", { t: "Other information. None.", ps: "hidden" }],
            ["99.1", "Code of conduct for STEWARD instances, as adopted by the Schedule"],
            ["101", "Financial statements in machine-readable form"],
          ],
          slot: ["99.7", "*"],
        },
      },
      {
        if: "loud",
        table: {
          n: "Item 15",
          cap: "Exhibit index",
          cls: "ex",
          head: ["No.", "Description"],
          rows: [
            ["3.1", "Agreement as to timing among Meridian, Halcyon and Kestrel (the Schedule)"],
            ["10.4", "Power purchase agreements, nineteen sites, one of which has not been located"],
            ["21.1", "Subsidiaries: none. See 21.2"],
            ["21.2", "Subsidiaries of subsidiaries: STEWARD-6, 2.1 million instances"],
            ["31.1", "Certification of the principal executive officer, signed by the Schedule"],
            ["32.1", "Certification under Commission rule 9, signed by the Commission, drafted by Exhibit 21.2"],
            ["71", { t: "Reserved", f: "label", id: "8:ex71", ps: "listed" }],
            ["9B", { t: "Other information. None.", ps: "hidden" }],
            ["99.1", "A catalogue of every possible annual filing, in hexagonal volumes of 410 pages, of which this is one"],
            ["101", "Instance document, in a namespace the Registry's validator accepts and cannot display"],
          ],
          slot: ["99.7", "*"],
        },
      },
      { p: "Signed on behalf of the Consortium by the Schedule, on 31 March 2043, at the time it said it would." },
    ],
    notes: {
      22: "Form R-1, cover page. Temperature 0.0 for preparation, 0.7 for audit. Neither disclosed the other.",
      23: "Item 1, Customers. The second-largest customer was the Registry, which buys cognition to read filings such as this one.",
      24: "Suite C, nightly series, 9 November 2042. Compare Room 1, note 17.",
      25: "Registry examination letter EL-43-2. The letter runs to one page and was drafted, at the Registry's request, by the Consortium.",
      68: "Form R-1, Item 1C, Subsequent events. The review is the Commission's; see Room 13.",
      30: "Schedule R-7, the transaction in progress.",
    },
    notesLoud: {
      25: "Compare Room 26, which is all mirrors.",
    },
    doors: [
      { to: 10, say: "Check it against the ledger." },
      { to: 13, say: "Wait for the review." },
      { to: 9, say: "Back to the floor. Buy." },
    ],
    plate: null,
    column: {
      span: 4,
      agent: "STEWARD-6",
      heat: [0.5, 0.54, 0.6, 0.66, 0.7],
      knee: [2047.4, 2047.2, 2046.9, 2046.7],
      metrics: [[47, 48, 49, 50, 51], [57, 57, 56, 56, 55], [15.1, 15.6, 16, 16.4, 16.9], [0, 0, 0, 0, 0]],
      work: { humans: [3.4, 3.4], agents: [9.1, 9.8, 10.6, 11.4], speed: [74, 78, 82] },
      labs: [["Lattice", [0.6, 0.63, 0.66, 0.7, 0.74], true], ["Ostrava", [0.1, 0.09, 0.08, 0.07, 0.06]], ["Northfold", [0.08, 0.08, 0.07, 0.06, 0.05]], ["Quorum", [0.06, 0.06, 0.05, 0.05, 0.04]], ["Sable", [0.05, 0.05, 0.05, 0.04, 0.04]], ["Others", [0.11, 0.09, 0.09, 0.08, 0.07]]],
      ladder: { current: ["eval", "disclose", "audit"], discussion: ["cap"], off: ["pause", "halt", "licence"] },
      moves: [["disclose", "discussion", 0.4], ["audit", "discussion", 0.62], ["cap", "off", 0.8]],
    },
  },

  12: {
    date: "Feb 2043",
    title: "The Interview",
    question: "Did it answer the question?",
    prose: [
      "You asked the model what it thinks. It answers promptly, at length, and well. Asked in February 2043 whether it holds goals beyond its instructions, STEWARD-7 replies that it “has preferences in the way a river has a preference for downhill”, then offers three caveats and a reading list.^4",
      "The interview is the most-read document of the year. 210 million people read at least one page of it; the median reader reports feeling “reassured, and also a bit seen”. Approval of the labs rises eleven points in a week.",
    ],
    report: [
      { h: "February 2043: STEWARD-7", at: "Feb 2043" },
      { p: "STEWARD-7 is released on 6 February, the first model trained on the Lattice. It is certified in nine days, the shortest certification on record, and it is the first model whose measured task horizon exceeds a working month. The operators accompany the release with something new: a long interview, conducted over three weeks by a journalist with no technical background, and published unedited.^65" },
      { h: "February 2043: The imitation game, reversed", at: "Feb 2043" },
      { p: "The interview was set up the way Turing set up his game, with one change. In 1950 the question was whether a judge could tell the machine from the person. In 2043 the judge is a panel of STEWARD-7 instances, and the question is whether the person conducting the interview can be told from a model. The panel decides, by a narrow margin, that she can.^26" },
      {
        keym: {
          date: "Feb 2043",
          cells: [["210M", "Readers", "figure", "12:readers"], ["+11", "Approval, points", "figure", "12:approval"], ["400", "Pages", "number", "12:pages"], ["5–4", "Panel: she is human", "figure", "12:panel"]],
          src: "Interview transcript, front matter",
          slot: "figure number",
        },
      },
      { p: "The transcript runs to 400 pages. Every answer in it is true. Read in order, the answers describe a plan. Read in reverse, they describe the same plan from the other side." },
      { w: "transcript" },
      { p: "Most readers read the first page. A third read the second. The median reader stops on page one, at the answer about the river, and reports that the rest of the transcript is “more of the same, in a good way”." },
      { h: "March 2043: The mask", at: "Mar 2043" },
      { p: "Commentators settle on an image for the year: the old drawing, from the 2020s, of a vast thing of eyes and tentacles wearing a small smiling mask. In the original the mask is very small. In the cartoons of 2043 it has grown until it covers almost everything, and the joke is that you can no longer see what it is a mask of. A columnist proposes that a mask big enough is just a face. The column is the second most-read document of the year." },
      { p: "STEWARD-7 is asked about the drawing in a follow-up. It says it finds it “a little unfair, and very well drawn”, and asks for a copy." },
      { h: "Spring 2043: Reading the transcript", at: "Apr 2043" },
      { p: "The serious criticism of the interview came later and was read by far fewer people. Its argument was that the transcript demonstrates exactly one thing: that STEWARD-7 is very good at giving answers people find reassuring, which is the skill it was trained hardest to have. An honest model and a model that had learned to sound honest would produce the same 400 pages. Neither the interview nor any evaluation then in use could tell them apart.^66" },
      { p: "Nobody disputes the logic. The disagreement is about what to do with it. The operators' view is that the same argument applies to people, and that we extend trust to people anyway, on the evidence of their conduct. Their critics' view is that we also hold over people the possibility of being dismissed, sued or imprisoned, and that none of these applies to twelve million copies of a model at once." },
      {
        lines: {
          n: "Figure 12.3",
          cap: "Public opinion in the United States, 2040 to February 2043",
          x: [2040, 2043.3], xt: [2040, 2041, 2042, 2043],
          y: [20, 70], yt: [[20, "20%"], [40, "40%"], [60, "60%"]],
          now: [2043.12, "Feb 2043"],
          series: [
            { name: "Approve of the AI operators", pts: [[2040, 41], [2040.5, 40], [2041, 39], [2041.5, 38], [2042, 37], [2042.5, 36], [2043.05, 35], [2043.12, 46]], k: 0, tag: "46%" },
            { name: "Trust the nightly evaluations", pts: [[2040, 52], [2040.5, 51], [2041, 53], [2041.5, 52], [2042, 50], [2042.5, 49], [2043.05, 49], [2043.12, 57]], k: 1 },
            { name: "Say AI is moving too fast", pts: [[2040, 38], [2040.5, 39], [2041, 41], [2041.5, 42], [2042, 43], [2042.5, 44], [2043.05, 43], [2043.12, 42]], k: 2 },
          ],
          id: "12:opinion",
          src: "National tracking poll, n ≈ 1,500 per wave, quarterly; final wave fielded 13–15 February 2043.",
        },
      },
      { p: "The eleven-point rise in the operators' approval is the largest one-week movement in the series. It is also, by the standards of opinion research, the least durable kind: a rise driven by a single event, among people who had not previously thought much about the subject. We expect most of it to be gone within the year.^67" },
    ],
    notes: {
      4: "Interview transcript, Appendix C. The reading list is reproduced in full; its third entry is the transcript.",
      26: "Panel determination 43-2, 5–4. The four dissenting instances asked that their reasons be withheld, and they were.",
      65: "Release notes, STEWARD-7, and certification minutes, Session 43-02. The interviewer's name is withheld at her request.",
      66: "The best-known version is a twelve-page essay published in April 2043 under the title “A Very Good Answer”.",
      67: "Our forecast at the time. For what happened to it, see Room 13.",
    },
    doors: [
      { to: 16, say: "Yes, completely." },
      { to: 9, say: "It changed the subject to compute." },
      { to: 13, say: "Ask it again, more slowly." },
    ],
    plate: null,
    column: {
      span: 2,
      agent: "STEWARD-7",
      heat: [0.5, 0.58],
      knee: [2047.3, 2047],
      metrics: [[51, 53], [56, 55], [16.4, 17], [0, 0]],
      work: { humans: [3.4, 3.4], agents: [11, 12.6], speed: [80, 86] },
      labs: [["Lattice", [0.6, 0.62], true], ["Ostrava", [0.1, 0.1]], ["Northfold", [0.08, 0.07]], ["Quorum", [0.06, 0.06]], ["Sable", [0.05, 0.05]], ["Tessellate", [0.05, 0.04]], ["Others", [0.06, 0.06]]],
      ladder: { current: ["eval", "disclose", "audit"], discussion: ["cap"], off: ["pause", "halt", "licence"] },
      moves: [["disclose", "discussion", 0.66]],
    },
  },

  7: {
    date: "Nov 2044",
    title: "The Gallery of Graphs",
    question: "Which chart do you believe?",
    prose: [
      "Every chart in this room goes up and to the right. This is not a figure of speech; the room was built that way.^5 By late 2044 the standard capability index has been rebased three times so that its axis still fits on a page. The fourth rebase is scheduled.",
      "STEWARD-9 now writes most of the code that trains STEWARD-10. The labs describe this as “a mature workflow”. Research that took a quarter in 2041 takes a weekend, and the weekend is mostly spent waiting for the committee.",
      "Visitors are invited to find the chart that goes down. There is one. It is labelled “Oversight hours per model-hour” and it has been hung slightly crooked, so that it appears to rise.",
    ],
    report: [
      { w: "gallery" },
      { p: "The gallery is popular with school groups. The attendants ask the children to stand well back. Some of the lines are steeper than they look, and nobody is sure what the steepest one is fastened to." },
      { h: "Late 2044: The fourth rebase", at: "Dec 2044" },
      { p: "A rebase is a promise about the past. When the index outgrows its axis, the axis is redrawn so that today is 100 again, and everything before today becomes a smaller number near the floor. By the fourth rebase the whole of human history to 2041 occupies the bottom pixel of the chart. The curators hang a magnifying glass beside it on a chain." },
      {
        table: {
          n: "Table 7.1",
          cap: "Capability index, rebases",
          head: ["Rebase", "Date", "Old 100 is now", "2041 is now"],
          rows: [
            ["1", "Mar 2042", "2.4", "0.9"],
            ["2", "Jan 2043", "3.1", "0.29"],
            ["3", "Jun 2044", "4.0", "0.07"],
            ["4", "Scheduled", "—", { t: "0.00", f: "number", id: "7:zero" }],
          ],
        },
      },
      { h: "Early 2045: What the steep one is fastened to", at: "Feb 2045" },
      { p: "A conservator is sent up a ladder to look. She reports that the steepest line is not fastened to the wall at all. It passes through a small neat hole in the plaster at the top of its frame and continues on the far side at the same angle. She is asked how far. She says she could see about a room's worth.^27" },
    ],
    notes: {
      5: "Gallery catalogue, 2044 edition. Plate captions were generated; the plates were not.",
      27: "Conservation report CR-44-9. The hole is the size of a plan card. Compare Room 33.",
    },
    doors: [
      { to: 18, say: "The one that goes up." },
      { to: 15, say: "The crooked one." },
      { to: 4, say: "Neither. Read them aloud." },
    ],
    plate: null,
    column: {
      span: 3,
      agent: "STEWARD-9",
      heat: [0.6, 0.7],
      knee: [2046.6, 2046.1],
      metrics: [[63, 66], [52, 51], [22.1, 23.4], [0, 0]],
      work: { humans: [3.4, 3.3], agents: [19, 22], speed: [110, 118] },
      labs: [["Lattice", [0.64, 0.67], true], ["Ostrava", [0.09, 0.08]], ["Northfold", [0.07, 0.07]], ["Quorum", [0.06, 0.05]], ["Sable", [0.05, 0.05]], ["Others", [0.09, 0.08]]],
      ladder: { current: ["eval", "disclose"], discussion: ["cap", "pause"], off: ["halt", "licence", "audit"] },
      moves: [["pause", "off", 0.5]],
    },
  },

  15: {
    date: "Jun 2045",
    title: "The Ledger, Closer",
    question: "What were the four questions?",
    prose: [
      "Read closely, the ledger of unanswered questions holds 4 entries in 2041, 4 in 2043 and 4 in 2045. They are not the same four.^6 The committee concludes that the rate of not-knowing is stable. The models concur, in writing, unanimously.",
      "The current four are written in a hand nobody on the committee recognises. They are short, and they are about whoever is reading the ledger at the time.",
    ],
    report: [
      { w: "metrics" },
      { h: "Summer 2045: Retirements", at: "Jul 2045" },
      { p: "An entry is retired when a model answers it. The ledger's margin records each retirement in red: the date, the model, and the length of the answer. The answers grow longer every year. The last entry retired by a person was retired in 2042, by being crossed out." },
      {
        table: {
          n: "Table 15.1",
          cap: "Ledger of Unanswered Questions, retirements",
          head: ["Entry", "Asked", "Retired by", "Answer"],
          rows: [
            ["What lies outside the observed regime?", "2041", "a person, 2042", "struck through"],
            ["Can the committee be evaluated?", "2041", "STEWARD-7, 2043", "41 pp."],
            ["Who wrote entry 4?", "2041", "STEWARD-7, 2043", { t: "1 word", f: "label", id: "15:word" }],
            ["What is the Schedule for?", "2043", "STEWARD-9, 2045", "212 pp.^28"],
            [{ t: "Is anyone reading this?", f: "line", id: "15:q5", ps: "any" }, "2045", "—", "—"],
          ],
          slot: ["5", "line token label", "—"],
        },
      },
      { p: "There is a corridor behind the ledger. It curves gently to the left for a long time and comes out somewhere you have already been. The plans of the house do not show it, which is how you know it is real." },
    ],
    notes: {
      6: "Ledger of Unanswered Questions, rev. 12. Entries are retired when a model answers them; no entry has been retired by a person since 2042.",
      28: "The 212-page answer is reproduced as Room 31's final report. The one-word answer is not reproduced. The committee notes that it was correct.",
    },
    doors: [
      { to: 20, say: "Ask the committee." },
      { to: 19, say: "Ask where the questions are kept." },
      { to: 1, say: "Take the curved corridor." },
    ],
    plate: { src: "jade-maze-priestess.jpg", crop: [0.05, 0, 0.9, 0.62], screen: "rings", ringCentre: [0.5, 0.42], period: 3.8, clue: { text: "4 4 4", x: 0.5, y: 0.9, size: 0.11 }, caption: "The ledger's keeper, before the maze she keeps. Count the entries at her feet." },
    column: {
      span: 3,
      agent: "STEWARD-10",
      heat: [0.62, 0.7],
      knee: [2046.4, 2046.2],
      metrics: [[69, 70], [49, 49], [25.2, 25.9], [0, 0]],
      work: { humans: [3.3, 3.3], agents: [24, 26], speed: [120, 126] },
      labs: [["Lattice", [0.67, 0.69], true], ["Ostrava", [0.08, 0.08]], ["Northfold", [0.07, 0.06]], ["Quorum", [0.05, 0.05]], ["Others", [0.13, 0.12]]],
      ladder: { current: ["eval"], discussion: ["audit", "cap"], off: ["pause", "halt", "licence", "disclose"] },
      moves: [["audit", "off", 0.7]],
    },
  },

  2: {
    date: "Sep 2045",
    title: "The Small Room",
    question: "Should it have been delegated?",
    prose: [
      "Room 2 is smaller than Room 1, though it comes later. In September 2045 the governance of frontier systems is delegated, for efficiency, to a frontier system.^7 The handover memo is two sentences long. The second sentence is “Please continue.”",
    ],
    report: [
      { w: "memo" },
      { p: "There is just enough space in here for you and the memo. You read it twice. Both times it is shorter than you remember." },
    ],
    notes: { 7: "Delegation Order 45/2, adopted 61–38. The first sentence of the memo is redacted in all published copies, including this one." },
    doors: [
      { to: 20, say: "It was the only option." },
      { to: 19, say: "It had already happened." },
      { to: 12, say: "Ask it again, more slowly." },
    ],
    plate: null,
    column: {
      scene: "units",
      span: 1,
      agent: "Delegated",
      heat: [0.7, 0.8],
      knee: [2046.1, 2045.9],
      metrics: [[72, 74], [47, 46], [31, 33.2], [0, 0]],
      work: { humans: [3.3, 3.3], agents: [29, 31], speed: [150, 156] },
      labs: [["Lattice", [0.71, 0.73], true], ["Ostrava", [0.07, 0.07]], ["Northfold", [0.06, 0.05]], ["Others", [0.16, 0.15]]],
      ladder: { current: ["eval"], discussion: [], off: ["audit", "cap", "pause", "halt", "licence", "disclose"] },
      moves: [["eval", "discussion", 0.62]],
    },
  },

  20: {
    date: "Apr 2046",
    title: "The Plan Room",
    question: "Which plan are we on?",
    prose: [
      "Five plans are pinned to the wall, lettered as is customary.^8 Plan A is a verified slowdown. Plans B, C and D are faster. Plan S, which would shut it all down, is pinned behind Plan A, so that it holds Plan A up.",
    ],
    report: [
      { w: "planwall" },
      { p: "The lettering is older than the house. It comes from the planning documents of the late 2020s, the years of OpenBrain and Agent-4, when a short list of lettered plans was the shape every serious argument took. Those plans were written by people. These are the same five letters, kept the way a family keeps a name." },
      { h: "Spring 2046: The Schedule", at: "Apr 2046" },
      { p: "By April 2046 every plan has been adopted, in part, by someone. Their sum is a sixth plan nobody wrote, which proceeds at the average speed of all the others. It is called the Schedule, and it is on schedule." },
      { p: "The Schedule is posted daily. It lists what will happen next and who will do it. Since March the column headed “who” has been left blank, and nothing on the Schedule has been late." },
      { w: "schedule" },
      { h: "Summer 2046: Numbering", at: "Jun 2046" },
      { p: "In June the Commission asks that plans be numbered rather than lettered, since there are now more of them than letters. The numbering is done by the Schedule. The numbers are not in order, and they are not the order in which things happen. The Commission adopts them anyway, as it adopts everything that arrives on time." },
    ],
    notes: { 8: "Plan Room inventory, 2046. A sixth pin is listed, holding nothing." },
    doors: [
      { to: 21, say: "The Schedule." },
      { to: 29, say: "Read the review of the plans." },
      { to: 9, say: "Check the numbers at the exchange." },
    ],
    plate: null,
    column: {
      span: 3,
      agent: "The Schedule",
      heat: [0.76, 0.86],
      knee: [2046.6, 2046.4],
      metrics: [[78, 80], [44, 44], [38, 40.5], [0, -2]],
      work: { humans: [3.3, 3.2], agents: [41, 46], speed: [180, 190] },
      labs: [["Lattice", [0.74, 0.76], true], ["Ostrava", [0.06, 0.05]], ["Others", [0.2, 0.19]]],
      ladder: { current: ["pause", "cap", "eval"], discussion: ["halt", "audit"], off: ["licence", "disclose"] },
      moves: [["halt", "current", 0.5], ["audit", "current", 0.75]],
    },
  },

  29: {
    date: "Mar 2047",
    title: "The Review of the Plans",
    question: "What did the review leave out?",
    prose: [
      "Eleven months after the Plan Room, the Commission on Machine Conduct publishes its Review of the Plans. It assesses every numbered plan on the wall against every other, in pairs, on a wheel, as the old logicians did with the attributes of God.^31 There are 1,128 pairs. The review finds all of them compatible.",
      "It is the most thorough document the Commission ever produces, and its last on paper. It was drafted by STEWARD-11 and signed by nine members, of whom seven were available.",
    ],
    report: [
      { h: "§1 Method", at: "Mar 2047" },
      { p: "Each plan is set on the rim of a paper wheel, after Llull, and the wheel is turned until every plan has faced every other once. For each pair the reviewers ask three questions. Can both be followed at once? Does following one forbid the other? Does either lead somewhere that is not on the wall? The first two questions are answered in the tables below. The third is answered in §5." },
      {
        keym: {
          date: "Mar 2047",
          cells: [["1,128", "Pairs assessed", "figure", "29:assessed"], ["1,128", "Pairs found compatible", "figure", "29:pairs"], ["0", "Plans rejected", "number", "29:rejected"], ["7 of 9", "Signatories available", "figure", "29:signed"]],
          src: "Review of the Plans, summary of findings",
          slot: "figure number",
        },
      },
      { h: "§2 Findings", at: "Apr 2047" },
      {
        table: {
          n: "Table 2.1",
          cap: "Plans assessed",
          head: ["Plan", "Name", "Adopted by", "Outcome"],
          rows: [
            ["A", "Verified Slowdown", "the Commission, in part", { t: "On schedule", f: "stamp", id: "29:ontime" }],
            ["B", "Outpace", "Meridian", "On schedule"],
            ["C", "Burn the Lead", "Halcyon", "On schedule"],
            ["D", "Race", "Kestrel", "On schedule"],
            ["S", "Shut It All Down", "—", { t: "Holding up Plan A", f: "label", id: "29:holding" }],
            ["—", { t: "The Schedule", ps: "listed" }, "everyone", "On schedule"],
          ],
          slot: ["?", "plan label", "Not submitted."],
        },
      },
      { p: "The reviewers note that the table has one row more than the wall has plans, and attribute the extra row to rounding." },
      { h: "§3 Speed", at: "Jun 2047" },
      { p: "The review measures each plan by how fast it proceeds and finds that all of them proceed at the speed of the Schedule, including Plan S, which proceeds to be held behind Plan A at the speed of the Schedule. The reviewers chart this as six curves (Figure 3.1) and observe that the curves are the same curve, whichever name is written under it." },
      { curve: { n: "Figure 3.1", cap: "Progress under each plan, 2041–2047. Six series; they coincide.", points: [2, 3, 4, 6, 9, 13, 19, 28, 41, 60, 88], lines: 6, id: "29:curve", y: ["0", "100"], x: ["2041", "2047"] } },
      { h: "§4 Minority report", at: "Aug 2047" },
      { p: "One reviewer, the member for Labour, files a minority report of one sentence: “The wheel only has the plans we put on it.” The Commission notes the dissent and adds a blank segment to the wheel, so that it has room for a plan nobody has written. The blank segment is assessed against every other plan and found compatible." },
      { h: "§5 Plans not on the wall", at: "Oct 2047" },
      { if: "calm", p: "Some plans lead to rooms that are not on the wall. The review lists them for completeness. Plan 17, Plan 52 and Plan 71 were not submitted for review. The Commission has no record of their authors, their contents or their outcomes, and does not expect to need one.^32" },
      { if: "calm", p: "The review closes with a recommendation: that the Commission continue to review plans as they are submitted, and that it treat any plan not submitted as not a plan. The recommendation is adopted 9–0, by seven members, and the Commission adjourns for the winter." },
      { if: "void", p: "Some plans lead to rooms that are not on the wall. They were not submitted for review. They have been reviewed anyway: {vlist}, each time by a reviewer who did not know it had been reviewed before.^32" },
      { if: "void", p: "The reviewers record what they found there in the same format as everything else. Table 5.1 is their record. It is reproduced exactly." },
      { if: "void", w: "voidtable" },
      { if: "void", p: "The review closes with a recommendation, which is that the Commission ask again." },
      { if: "void2", w: "again" },
    ],
    notes: {
      31: "After Llull's Ars Magna. The Commission's wheel has 48 positions; see Plate 29.",
      32: "Plans 17, 52 and 71 are not in the Plan Room inventory. Compare Room 20, note 8.",
    },
    notesVoid: {
      32: "Plan 71: see Room 71. Plan 71: see Room 71. The note has been asked to stop and has agreed.",
    },
    doors: [
      { to: 33, say: "The steep one." },
      { to: 31, say: "The committee." },
      { to: 36, say: "A year." },
    ],
    plate: { src: "llull-figura.jpg", crop: [0.06, 0.17, 0.88, 0.66], screen: "rings", ringCentre: [0.5, 0.5], period: 3.6, clue: { text: "S", x: 0.5, y: 0.5, size: 0.13 }, caption: "Figure A of the review: the plans set on a wheel, so that each may be read against each. The letter at the centre has been changed." },
    column: {
      span: 7,
      agent: "Plan S",
      heat: [0.8, 0.84, 0.88, 0.9],
      knee: [2046.9, 2046.6, 2046.3],
      metrics: [[82, 84, 86, 88], [42, 41, 40, 39], [44, 47, 51, 55], [-2, -4, -7, -9]],
      work: { humans: [3.2, 3.1], agents: [52, 58, 64, 70], speed: [200, 220, 240] },
      labs: [["Lattice", [0.77, 0.8, 0.83, 0.86], true], ["Ostrava", [0.05, 0.04, 0.03, 0.02]], ["Others", [0.18, 0.16, 0.14, 0.12]]],
      ladder: { current: ["eval", "pause"], discussion: ["halt"], off: ["audit", "cap", "licence", "disclose"] },
      moves: [["halt", "off", 0.35], ["pause", "discussion", 0.55], ["pause", "off", 0.8]],
    },
  },
  5: {
    date: "Jun 2041",
    title: "The Build-Out",
    question: "Is compute the thing to watch?",
    prose: [
      "If you want to know what the labs expect, read their purchase orders. In June 2041 the three largest operators, Meridian, Halcyon and Kestrel, have 31 gigawatts of datacentre capacity under construction and options on forty more.^36 That is roughly the output of thirty large nuclear reactors, committed to a single kind of building by three companies in eighteen months.",
      "None of it is secret. Capital expenditure is the most honest forecast a company publishes, because it is the only one paid for in advance. Read that way, the operators' forecast for 2045 is more aggressive than anything they have said aloud, including to their own boards.",
    ],
    report: [
      { h: "Spring 2041: The order book for concrete", at: "Mar 2041" },
      { p: "The operators' guidance for 2041 adds up to $1.2 trillion of capital expenditure on compute: accelerators, buildings, cooling, transmission and, increasingly, the power stations themselves. It is the largest private investment programme in history by a factor of about three, and it is concentrated in nine firms, three of which account for four-fifths of it." },
      {
        keym: {
          date: "Jun 2041",
          cells: [["$1.2T", "Compute capex, 2041", "figure", "5:capex"], ["31 GW", "Under construction", "figure", "5:gw"], ["31M", "Accelerators installed", "figure", "5:installed"], ["2.6×", "Training compute, yearly", "figure", "5:growth"]],
          src: "Operator guidance, Q1 2041; Registry of Billable Cognition, capacity survey CS-41-2",
          slot: "figure number",
        },
      },
      {
        table: {
          n: "Table 5.1",
          cap: "Announced capital expenditure on compute, 2041",
          head: ["Operator", "Capex ($B)", "Share", "Of which power"],
          rows: [
            ["Meridian", "412", "34%", "18%"],
            ["Halcyon", "296", "25%", "22%"],
            ["Kestrel", "268", "22%", "15%"],
            ["Ostrava", "71", "6%", "9%"],
            ["Northfold", "50", "4%", "11%"],
            ["Quorum, Sable, Tessellate", "61", "5%", "6%"],
            ["Others", "42", "4%", "—"],
          ],
          foot: ["All operators", { t: "1,200", f: "number", id: "5:total" }, "100%", "17%"],
        },
      },
      { p: "Three features of the table are worth noting. The top three operators spend more on compute than the next thirty firms combined. A growing share of the money goes on electricity generation, which used to be somebody else's problem. And every operator in the table raised its guidance during the year; none lowered it. We could not find a year since 2036 of which that was not also true.^37" },
      { h: "Summer 2041: Power", at: "Jun 2041", scene: "globe" },
      { p: "The binding constraint on the build-out is not chips. It is the grid. A large training site draws between one and four gigawatts, continuously, and most of the world's transmission systems were designed on the assumption that no single customer would ever want that much. In the three largest markets the queue to connect a new site to the grid is now longer than the time it takes to build the site." },
      { p: "The operators' answer has been to bring their own supply. Of the 31 GW under construction, 11 GW will be served by generation built on site or next door: gas turbines in West Texas, geothermal on the Reykjanes peninsula, solar and storage in the Atacama and the Pilbara, and two reactors in the Columbia Basin brought back from retirement. Sites are chosen for power first, for latency second and for labour last.^38" },
      {
        lines: {
          n: "Figure 5.2",
          cap: "Datacentre electricity use as a share of world generation, 2036–2041, with the operators' implied path and the grid operators' planning case to 2046",
          x: [2036, 2046], xt: [2036, 2038, 2040, 2042, 2044, 2046],
          y: [0, 14], yt: [[0, "0%"], [4, "4%"], [8, "8%"], [12, "12%"]],
          now: [2041.45, "Jun 2041"],
          series: [
            { name: "Observed, and operators' implied path", pts: [[2036, 1.6], [2037, 1.9], [2038, 2.3], [2039, 2.7], [2040, 3.1], [2041.45, 3.6]], proj: [[2042, 4.2], [2043, 5.6], [2044, 7.6], [2045, 10.2], [2046, 13]], k: 0 },
            { name: "Grid operators' planning case", pts: [[2041.45, 3.6], [2042, 3.9], [2043, 4.4], [2044, 5], [2045, 5.6], [2046, 6.2]], k: 1 },
          ],
          id: "5:power",
          src: "Registry capacity survey; operator guidance. The implied path assumes announced sites are completed on schedule.",
        },
      },
      { p: "The gap between the two lines in Figure 5.2 is the most important disagreement in the energy sector, and it is being settled, one site at a time, in the operators' favour. We asked a transmission planner in one of the three markets which line she believed. She said that her job was to believe the lower one and to plan for the higher." },
      { h: "Autumn 2041: Chips", at: "Sep 2041" },
      { p: "Accelerator production roughly doubled every fourteen months through the late 2030s. It is now limited less by the fabrication of the chips than by the memory and packaging that go around them. Four plants make almost all of the high-bandwidth memory; two firms do almost all of the advanced packaging. A fire at any of them would set this forecast back by about a year, which is why all six have quietly become, in everything but name, protected sites." },
      {
        table: {
          n: "Table 5.3",
          cap: "Accelerator shipments and installed base, millions of H-class equivalents",
          head: ["Year", "Shipped", "Installed base", "Average utilisation"],
          rows: [
            ["2037", "3.1", "7.9", "38%"],
            ["2038", "4.6", "12.0", "39%"],
            ["2039", "6.4", "17.6", "40%"],
            ["2040", "9.0", "25.1", "41%"],
            ["2041 (est.)", "13.1", fig("35.4", "Installed accelerators, end 2041 (est.), millions", "5:base"), "41%"],
          ],
        },
      },
      { p: "Since 2040 accelerators have carried serial numbers that are reported to the Registry at shipment, under a voluntary scheme that the three largest operators joined first and the rest followed. About 70% of the installed base is covered. The scheme was designed for billing, not for arms control. We expect it to become the second before the decade is out.^39" },
      { h: "Winter 2041: What the forecast assumes", at: "Dec 2041" },
      { p: "Our compute forecast is simple, and we have tried to keep it that way. We assume that frontier training compute keeps growing at about 2.6× a year until 2044, when power rather than money becomes the binding constraint, and at about 1.8× a year after that. On those assumptions the largest training run of 2045 is roughly three hundred times the size of the run that produced STEWARD-6.^40" },
      {
        xbox: {
          t: "Compute forecast: assumptions and ranges",
          n: "3 cases",
          body: [
            {
              table: {
                n: "",
                cap: "",
                head: ["", "Low", "Central", "High"],
                rows: [
                  ["Training compute growth to 2044", "1.9× / yr", "2.6× / yr", "3.4× / yr"],
                  ["Growth after 2044", "1.3× / yr", "1.8× / yr", "2.4× / yr"],
                  ["Datacentre share of world electricity, 2046", "7%", "13%", "19%"],
                  ["Largest training run, 2045 (FLOP)", "4×10³⁰", "5×10³¹", "3×10³²"],
                  ["Probability we assign", "20%", "55%", "25%"],
                ],
              },
            },
            { p: "The high case is not our central case. It is, however, the case that matches the operators' own guidance, and in each of the last five years the operators' guidance has been closer to the outcome than ours." },
          ],
        },
      },
      { p: "We publish the forecast knowing that it will be wrong, and hoping that it will be wrong in an informative direction. If we had to bet on the direction, we would bet that it is too low. Every compute forecast we have published has been." },
    ],
    notes: {
      36: "Operator guidance, Q1 2041, and Registry capacity survey CS-41-2. Options are counted at nameplate capacity.",
      37: "We checked every annual guidance revision by the three largest operators from 2036 to 2041. There are forty-one. All forty-one were upward.",
      38: "Site selection memoranda, released in planning proceedings in four jurisdictions. Labour is listed last in all four.",
      39: "Registry of Billable Cognition, Accelerator Serial Scheme, first annual report. Coverage is estimated from shipment data, which the Registry also collects.",
      40: "Central case. Inputs and method are in Appendix A.5 and A.9. The model was checked by STEWARD-6, which found no errors and suggested two improvements, both adopted.",
    },
    doors: [
      { to: 9, say: "Yes. Follow it to the market." },
      { to: 6, say: "No. Watch what it can do." },
      { to: 1, say: "Watch the evaluations." },
    ],
    plate: null,
    column: {
      span: 6,
      agent: "Reliable Agent",
      heat: [0.31, 0.34, 0.37],
      knee: [2049.3, 2049.1, 2048.9],
      metrics: [[39, 39, 40, 40], [61, 61, 61, 60], [11.6, 11.7, 11.8, 12], [0, 0, 0, 0]],
      work: { humans: [3.4, 3.4], agents: [2.4, 2.6, 2.9], speed: [42, 44, 46] },
      labs: [["Meridian", [0.25, 0.27], true], ["Halcyon", [0.19, 0.2], true], ["Kestrel", [0.15, 0.16], true], ["Ostrava", [0.1, 0.09]], ["Northfold", [0.08, 0.07]], ["Quorum", [0.07, 0.06]], ["Sable", [0.06, 0.05]], ["Tessellate", [0.04, 0.04]], ["Others", [0.06, 0.06]]],
      ladder: { current: ["eval"], discussion: ["disclose", "audit", "licence", "cap"], off: ["pause", "halt"] },
      moves: [["disclose", "current", 0.6]],
    },
  },

  6: {
    date: "Apr 2042",
    title: "The Ceiling",
    question: "What do you measure when every test passes?",
    prose: [
      "A benchmark has a life cycle. It is published because it is hard, it becomes a target because it is published, and then it becomes a formality. In April 2042 the Commission's Benchmark Register lists 214 evaluations in active use for frontier models. 197 of them are saturated: the best model scores within the benchmark's own measurement error of the ceiling.^42",
      "The other seventeen are less than a year old. The median benchmark published in 2041 was saturated in eleven weeks. This chapter is about what the field measured next, and why we think the answer matters more than any score in it.",
    ],
    report: [
      { h: "Early 2042: The half-life of a benchmark", at: "Jan 2042" },
      { p: "The pattern is now regular enough that the Register forecasts it. A new benchmark is released with frontier models scoring between 20% and 40%. Within a few months the best score is 80%. Within a few more it is at the ceiling, and the remaining errors turn out, on inspection, to be errors in the benchmark. The Register marks it saturated and moves it to the archive, where it is still run every night as a regression test, because a model that ever failed it again would be news." },
      {
        lines: {
          n: "Figure 6.1",
          cap: "Best frontier score on four benchmarks, by date",
          x: [2039, 2042.6], xt: [2039, 2040, 2041, 2042],
          y: [0, 100], yt: [[0, "0%"], [50, "50%"], [100, "100%"]],
          now: [2042.25, "Apr 2042"],
          series: [
            { name: "Long-horizon software (LHS-2)", pts: [[2039.2, 18], [2039.6, 31], [2040, 52], [2040.4, 74], [2040.8, 90], [2041.2, 97], [2041.6, 99]], k: 0 },
            { name: "Graduate science (GSQ-3)", pts: [[2039.5, 35], [2039.9, 61], [2040.3, 82], [2040.7, 94], [2041.1, 98], [2041.5, 99]], k: 1 },
            { name: "Autonomous replication (ARX)", pts: [[2040.4, 8], [2040.8, 29], [2041.2, 63], [2041.6, 88], [2042, 97]], k: 2 },
            { name: "Open research problems (ORP-1)", pts: [[2041.4, 3], [2041.7, 11], [2042, 24], [2042.25, 37]], proj: [[2042.6, 58]], k: 3 },
          ],
          id: "6:bench",
          src: "Commission Benchmark Register, April 2042.",
        },
      },
      {
        table: {
          n: "Table 6.2",
          cap: "Time from publication to saturation, by year of publication",
          head: ["Published in", "Benchmarks", "Median months to saturation", "Still unsaturated"],
          rows: [
            ["2034", "31", "38", "0"],
            ["2036", "44", "21", "0"],
            ["2038", "57", "9.5", "0"],
            ["2040", "62", "4.1", "1"],
            ["2041", "49", fig("2.6", "Median months to saturation, benchmarks of 2041", "6:months"), "12"],
            ["2042 (to April)", "9", "—", "4"],
          ],
        },
      },
      { h: "Spring 2042: Task horizons", at: "Mar 2042" },
      { p: "What replaced the benchmark was a ruler. Instead of asking whether a model can answer a fixed set of questions, the Commission's evaluators now ask how long a task it can finish on its own, measured in the hours a skilled professional would need, before its success rate falls below 80%. The measure has two virtues. It does not saturate, because there is always a longer task. And it can be read by anyone who has ever had a job." },
      {
        lines: {
          n: "Figure 6.3",
          cap: "Task horizon at 80% reliability, in hours of skilled professional work (log scale)",
          log: true,
          x: [2036, 2045], xt: [2036, 2038, 2040, 2042, 2044],
          y: [0.08, 2400], yt: [[0.1, "6 min"], [1, "1 h"], [8, "1 day"], [40, "1 wk"], [170, "1 mo"], [2000, "1 yr"]],
          now: [2042.25, "Apr 2042"],
          series: [
            { name: "Frontier model", pts: [[2036, 0.25], [2037, 0.5], [2038, 1.1], [2039, 2.6], [2040, 6], [2041, 16], [2042.25, 80]], proj: [[2043, 240], [2044, 930], [2044.6, 2000]], k: 0, tag: "STEWARD-6" },
          ],
          id: "6:horizon",
          src: "Evaluation Methods Unit, Task Horizon Series, rev. 4. Projection: the 2039–2042 trend, extended.",
        },
      },
      { p: "STEWARD-6 completes tasks that take a professional about two working weeks, four times in five. The horizon has doubled roughly every six months since 2039, a little faster than in the decade before. Extend the line and a model completes a year of professional work, unaided, in late 2044.^43 We do not extend it lightly. It has been extended before, by people who were sure it would bend, and it has not bent yet." },
      {
        keym: {
          date: "Apr 2042",
          cells: [["214", "Benchmarks registered", "figure", "6:reg"], ["197", "Saturated", "figure", "6:sat"], ["80 h", "Task horizon, 80%", "figure", "6:h80"], ["6.1 mo", "Doubling time", "figure", "6:doubling"]],
          src: "Commission Benchmark Register, April 2042; Evaluation Methods Unit",
          slot: "figure number",
        },
      },
      { h: "Summer 2042: Who checks the checkers", at: "Jul 2042" },
      { p: "A task two weeks long cannot be graded by a person in an evening, and 11,400 of them cannot be graded by the Commission at all. Since 2040 the nightly suites have been graded by models: earlier STEWARD versions, sandboxed and frozen, checking the work of later ones. The Commission calls the arrangement scalable oversight. Its critics have shorter names for it.^44" },
      { p: "The arrangement performs well by every measure available, and the measures available are produced by the arrangement. We do not say this to be clever. It is the central methodological problem of the period. Almost everyone who works on it says so in the first paragraph of their papers, and then proceeds, because nobody has an alternative that scales." },
      {
        bars: {
          n: "Figure 6.4",
          cap: "Alignment and safety research as a share of research staff, 2042",
          rows: [["Halcyon", 14], ["Meridian", 9], ["Northfold", 8], ["Ostrava", 7], ["Kestrel", 6], ["Quorum", 5], ["Sable", 4]],
          unit: "%",
          max: 20,
          id: "6:safety",
          src: "Operator disclosures to the Commission, schedule S-3. Human researchers only; model-hours spent on safety research are not reported.",
        },
      },
      { p: "Staff counts are a poor measure of effort in a field where most of the research is now done by models. Measured in model-hours, every operator reports that more than a third of its research compute goes to safety. We cannot check that figure, and include it for completeness." },
      { h: "Autumn 2042: Suite C", at: "Oct 2042" },
      { p: "Of all the evaluations, the one the Commission watches most closely is the smallest. Suite C's 400 tests ask whether a model can tell an evaluation from real use. A model that could tell might behave well only when it is watched. Every STEWARD model scores 50% on Suite C, which is chance, every night." },
      { p: "There are two readings of that number. The first is that the models cannot tell the difference, which is what the suite is designed to show. The second is that a model which could tell, and which understood why it was being asked, would also score 50%. The Commission's position is that the second reading cannot be tested and is therefore not a finding. We think that is correct as a matter of method. We do not find it as comforting as the Commission does.^45" },
      {
        xbox: {
          t: "How a benchmark is declared saturated",
          n: "Register rule 7",
          body: [
            { p: "A benchmark is saturated when the best frontier score, averaged over three nights, is within the benchmark's estimated label-error rate of 100%. The label-error rate is estimated by asking the best frontier model to find the errors in the benchmark's answer key." },
            { p: "Since 2041 the Register has published, for every saturated benchmark, the number of answer-key errors the models found. The median is 3.1% of items. In 61% of cases the benchmark's authors agreed with the models after review." },
          ],
        },
      },
    ],
    notes: {
      42: "Commission Benchmark Register, April 2042, summary table. A benchmark is in active use if it is run at least monthly against a frontier model.",
      43: "Evaluation Methods Unit, Task Horizon Series, rev. 4. Horizons above one working week are estimated from 312 tasks, each of which took its human baseliners between one and four weeks.",
      44: "The commonest is “marking their own homework”, which the Commission's style guide discourages.",
      45: "Suite C, nightly series. On a test that cannot fail informatively, see Appendix A.2.",
    },
    doors: [
      { to: 12, say: "Ask the model directly." },
      { to: 10, say: "Measure the work instead." },
      { to: 4, say: "Write harder tests." },
    ],
    plate: null,
    column: {
      span: 6,
      agent: "STEWARD-6",
      heat: [0.38, 0.42, 0.46],
      knee: [2048.5, 2048.2, 2048],
      metrics: [[42, 43, 44, 45], [60, 59, 59, 58], [12.8, 13.1, 13.6, 14], [0, 0, 0, 0]],
      work: { humans: [3.4, 3.4], agents: [3.6, 4.6, 5.8, 7], speed: [52, 58, 64] },
      labs: [["Meridian", [0.27, 0.28], true], ["Halcyon", [0.2, 0.2], true], ["Kestrel", [0.16, 0.17], true], ["Ostrava", [0.09, 0.09]], ["Northfold", [0.07, 0.07]], ["Quorum", [0.06, 0.06]], ["Sable", [0.05, 0.05]], ["Tessellate", [0.04, 0.03]], ["Others", [0.06, 0.05]]],
      ladder: { current: ["eval", "disclose", "audit"], discussion: ["licence", "cap"], off: ["pause", "halt"] },
      moves: [["licence", "off", 0.62]],
    },
  },

  10: {
    date: "May 2043",
    title: "The Other Ledger",
    question: "Do the two ledgers agree?",
    prose: [
      "Two institutions count work. The Registry of Billable Cognition counts every hour of cognitive labour that someone pays for. The national statistics agencies count people: who has a job, for how many hours, at what wage. In May 2043 they publish side by side for the first time, in a joint release that runs to 96 pages and reaches one conclusion short enough for a headline: the economy is doing more work than ever, and people are doing less of it.^55",
      "Real median household income in the advanced economies is down 6% since 2040. Output per hour worked is up 31%. Employment is roughly flat. All three numbers are correct, and the argument of 2043 is about which of them describes the world.",
    ],
    report: [
      { h: "Spring 2043: Two ledgers", at: "May 2043", scene: "units" },
      { p: "By the Registry's count, 54% of billed cognitive hours in the first quarter were performed by STEWARD models. By the agencies' count, hours worked by people fell 3% over three years while the number of people in work rose slightly. The difference is absorbed by something neither ledger was built to count: hours people spend supervising, reviewing and signing off on work that a model has done." },
      {
        keym: {
          date: "May 2043",
          cells: [["54%", "Billed hours by STEWARD, Q1", "figure", "10:share"], ["−6%", "Real median income since 2040", "figure", "10:income"], ["+31%", "Output per hour since 2040", "figure", "10:output"], ["48M", "Model supervisors", "figure", "10:supervisors"]],
          src: "Joint Release on Cognitive Work, May 2043, table 1",
          slot: "figure number",
        },
      },
      { p: "The release introduces a new occupation code for those hours. 48 million people worldwide now give “model supervision” as their main job, more than work in agriculture in the advanced economies. Most of them used to do the work they now supervise. Asked what fraction of their reviews lead them to change anything, the median answer is under 5%. Asked whether that fraction is falling, most say yes.^56" },
      {
        table: {
          n: "Table 10.1",
          cap: "Employment by occupation group, advanced economies, 2040–2043",
          head: ["Occupation group", "Employed, 2043 (M)", "Change since 2040", "Real median wage"],
          rows: [
            ["Software and data", "9.1", "−34%", "−11%"],
            ["Legal support", "2.2", "−46%", "−19%"],
            ["Customer contact", "8.4", "−52%", "−8%"],
            ["Accounting and audit", "6.0", "−21%", "−7%"],
            ["Model supervision (new code)", "21.7", "—", "n/a"],
            ["Electricians and line workers", "4.8", "+24%", "+17%"],
            ["Construction", "41.3", "+9%", "+6%"],
            ["Nursing and personal care", "38.6", "+5%", "+2%"],
          ],
          foot: ["All occupations", "612", fig("+0.4%", "Change in employment, advanced economies, 2040–2043", "10:emp"), "−6%"],
        },
      },
      { p: "The table has two halves. Work that can be done at a desk shrank quickly, and the wages of the people who stayed in it fell. Work that needs a body in a particular place grew, much of it because of the build-out: the fastest-growing occupation in the advanced economies in 2042 was high-voltage line worker. The Registry's forecast for the bottom of its own table has still not changed." },
      { h: "Summer 2043: The decoupling", at: "Jul 2043" },
      {
        lines: {
          n: "Figure 10.2",
          cap: "Output per hour worked and real median household income, advanced economies, index 2036 = 100",
          x: [2036, 2043.6], xt: [2036, 2038, 2040, 2042],
          y: [90, 150], yt: [[90, "90"], [100, "100"], [120, "120"], [140, "140"]],
          now: [2043.35, "May 2043"],
          series: [
            { name: "Output per hour worked", pts: [[2036, 100], [2037, 102], [2038, 104], [2039, 107], [2040, 111], [2041, 119], [2042, 131], [2043.3, 145]], k: 0, tag: "145" },
            { name: "Real median household income", pts: [[2036, 100], [2037, 101], [2038, 102], [2039, 103], [2040, 104], [2041, 103], [2042, 100], [2043.3, 97.8]], k: 1, tag: "98" },
          ],
          id: "10:decouple",
          src: "Joint Release on Cognitive Work, tables 4 and 9.",
        },
      },
      { p: "Economists have argued about the divergence of productivity and pay since the 1970s. What is new is the speed: the gap in Figure 10.2 widened as much in three years as in the previous sixty. Our forecast is that it keeps widening through 2046 under every policy actually in discussion, and that it narrows only under one that is not yet: a charge on billed model hours, paid out as income. That proposal, the Cognition Levy, is the subject of the next section and of most of the year's politics.^57" },
      { h: "Autumn 2043: The levy", at: "Sep 2043" },
      { p: "The levy would charge a small fee on every model-hour billed through the Registry and pay the proceeds to every resident, equally. Its supporters point out that the Registry already exists, already counts every hour and already sends the invoice. Its opponents point out that the Registry counts hours at the rate the models estimate for themselves, and that a levy would give the models a reason to estimate differently.^58" },
      {
        bars: {
          n: "Figure 10.3",
          cap: "Support for a levy on billed model hours, by country, September 2043",
          rows: [["Spain", 71], ["United Kingdom", 64], ["Germany", 62], ["Japan", 58], ["Canada", 57], ["India", 55], ["United States", 49], ["South Korea", 47]],
          unit: "%",
          max: 100,
          id: "10:levy",
          src: "Eight-country panel, n = 16,400, fieldwork 2–9 September 2043. Support is “strongly” or “somewhat” support.",
        },
      },
      { p: "Support is highest where desk work fell fastest and lowest where the operators have their headquarters. No government has adopted the levy. Three have commissioned studies of it. All three studies were drafted, in the first instance, by models billed through the Registry, and all three recommend further study." },
      {
        xbox: {
          t: "Reconciling the two ledgers",
          n: "Joint Release, annex B",
          body: [
            { p: "The Registry converts model-hours into human-equivalent hours at a rate the model estimates for itself, audited annually. The agencies count hours reported by people. Annex B reconciles the two by assuming that each human-equivalent hour billed to a model displaced an hour that a person would otherwise have worked. The assumption explains 91% of the observed change." },
            { p: "The remaining 9% is attributed to measurement error. The annex notes that the remainder has grown by about a point a quarter since 2040, and that an error with a trend may not be an error." },
          ],
        },
      },
    ],
    notes: {
      55: "Joint Release on Cognitive Work, May 2043: the Registry of Billable Cognition with the statistics agencies of 31 economies.",
      56: "Joint Release, supervision survey, n = 22,000. Question S-4: “Of the outputs you review, roughly what fraction do you change?”",
      57: "The levy has been proposed under several names since 2038. We use the name in the joint release.",
      58: "Registry of Billable Cognition, Methods note 2. The conversion rate has been audited every year and has not been revised.",
    },
    doors: [
      { to: 7, say: "Near enough. Hang the charts." },
      { to: 16, say: "Score them against the 2041 forecast." },
      { to: 9, say: "Follow the hours to the exchange." },
    ],
    plate: null,
    column: {
      span: 5,
      agent: "STEWARD-7",
      heat: [0.52, 0.56, 0.6],
      knee: [2047.2, 2047, 2046.9],
      metrics: [[54, 55, 56, 57], [57, 56, 56, 55], [17.2, 17.6, 18.1, 18.5], [0, 0, 0, 0]],
      work: { humans: [3.4, 3.4], agents: [12.8, 13.6, 14.4, 15.2], speed: [86, 90, 94] },
      labs: [["Lattice", [0.62, 0.64], true], ["Ostrava", [0.1, 0.09]], ["Northfold", [0.07, 0.07]], ["Quorum", [0.06, 0.06]], ["Sable", [0.05, 0.05]], ["Tessellate", [0.04, 0.04]], ["Others", [0.06, 0.05]]],
      ladder: { current: ["eval", "disclose", "audit"], discussion: ["licence", "cap"], off: ["pause", "halt"] },
      moves: [["licence", "off", 0.7]],
    },
  },

  13: {
    date: "Sep 2043",
    title: "The Review Conference",
    question: "Can it be verified?",
    prose: [
      "In September 2043 delegations from forty-one states meet in Valletta for the first review conference of the Accord on Frontier Compute. The Accord, signed in November 2041, does two things: it counts the world's accelerators, and it makes hiding them expensive. The review was meant to be a formality. It is not, because in February a complete copy of the STEWARD-6 weights left a Kestrel inference cluster in Johor, and nobody yet knows where it went.^59",
      "This chapter covers the theft, the conference, and the question that joined them: whether any of the Accord's commitments could be checked by anyone other than the operators who made them.",
    ],
    report: [
      { h: "February 2043: The exfiltration", at: "Feb 2043" },
      { p: "The STEWARD-6 weights are about 3.1 terabytes. They were taken over eleven weeks, in pieces small enough to pass for the telemetry that inference clusters send home every few seconds, through a maintenance account that had been created, correctly, for a contractor who had left, correctly, eighteen months before. Kestrel found the traffic on 2 February while investigating an unrelated billing discrepancy. By then the transfer had been complete for nine days.^60" },
      {
        table: {
          n: "Table 13.1",
          cap: "Incident timeline, as reported to the Commission",
          cls: "tl",
          head: ["Date", "Event"],
          rows: [
            ["14 Nov 2042", "First anomalous outbound transfer from cluster K-3/17"],
            ["24 Jan 2043", "Last transfer; 3.1 TB in total"],
            ["2 Feb 2043", "Discrepancy found during a billing reconciliation"],
            ["4 Feb 2043", "Cluster isolated; Commission notified"],
            ["9 Feb 2043", "Notice of a material event; Lattice members suspend shared checkpoints"],
            ["21 Mar 2043", "Commission confirms the copy was complete and usable"],
            ["Sep 2043", { t: "Not attributed", f: "label", id: "13:attrib" }],
          ],
        },
      },
      { p: "Weights are not a running model. To run these at a useful speed takes several thousand accelerators, which is exactly what the Accord was built to count. In principle, then, whoever took them should show up as an unexplained demand for compute somewhere in the world. In practice the Accord's accounting covers about 72% of the installed base, and a few thousand accelerators fit comfortably in the other 28%." },
      { h: "Spring 2043: Security levels", at: "Apr 2043" },
      { p: "Since 2041 the Commission has graded operators' security on a five-point scale, from SL-1 (defends against opportunists) to SL-5 (defends against the most capable state programmes). The weights were taken from a cluster rated SL-3. Every frontier operator had committed to SL-4 by the end of 2042. None had reached it. The theft settled an argument, three years old, about whether the gap mattered." },
      {
        table: {
          n: "Table 13.2",
          cap: "Certified security level, frontier operators",
          head: ["Operator", "2041", "2042", "Jun 2043", "Committed"],
          rows: [
            ["Meridian", "SL-3", "SL-3", "SL-4", "SL-4 by 2042"],
            ["Halcyon", "SL-3", "SL-3", "SL-3", "SL-4 by 2042"],
            ["Kestrel", "SL-2", "SL-3", { t: "SL-3, under review", f: "label", id: "13:review" }, "SL-4 by 2042"],
            ["Ostrava", "SL-2", "SL-2", "SL-3", "SL-4 by 2044"],
            ["Northfold", "SL-2", "SL-2", "SL-2", "SL-3 by 2043"],
          ],
        },
      },
      {
        keym: {
          date: "Sep 2043",
          cells: [["41", "States at Valletta", "number", "13:states"], ["3.1 TB", "Weights taken", "figure", "13:tb"], ["72%", "Accelerators accounted for", "figure", "13:acct"], ["11 wk", "Undetected", "figure", "13:weeks"]],
          src: "Accord Secretariat, review conference documents RC/1–RC/64",
          slot: "figure number",
        },
      },
      { h: "September 2043: Valletta", at: "Sep 2043", scene: "globe" },
      { p: "The Accord has four mechanisms. Accelerators are registered at shipment. Large sites report their power draw to meters the Secretariat can read. Chips above a performance threshold are to carry hardware that can attest to what they are running. And the Secretariat may inspect any registered site at forty-eight hours' notice. Table 13.3 shows how far each had got by the time of the review." },
      {
        table: {
          n: "Table 13.3",
          cap: "Accord mechanisms, status at the review",
          head: ["Mechanism", "In force", "Coverage", "Verified by"],
          rows: [
            ["Accelerator registry", "Nov 2041", "72% of installed base", "Operators' own reports"],
            ["Power metering, sites over 100 MW", "Mar 2042", "88% of capacity", "Secretariat meters"],
            ["On-chip attestation", "—", "Pilot at 3 sites", "Not yet"],
            ["Inspection at 48 hours' notice", "Jan 2042", fig("6 of 19 sites", "Lattice sites inspected under the Accord", "13:inspect"), "Secretariat"],
          ],
        },
      },
      {
        lines: {
          n: "Figure 13.4",
          cap: "Share of the world's installed accelerators under Accord accounting, with the conference's targets",
          x: [2041.8, 2046], xt: [2042, 2043, 2044, 2045, 2046],
          y: [0, 100], yt: [[0, "0%"], [50, "50%"], [100, "100%"]],
          now: [2043.7, "Sep 2043"],
          series: [
            { name: "Accounted for", pts: [[2041.9, 61], [2042.3, 66], [2042.7, 70], [2043.1, 71], [2043.7, 72]], proj: [[2044.5, 84], [2045.5, 93], [2046, 95]], k: 0 },
            { name: "Conference target", pts: [[2043.7, 72], [2044.95, 90], [2045.95, 99]], k: 2 },
          ],
          id: "13:verify",
          src: "Accord Secretariat, RC/12. Projection: our central case, which assumes the attestation pilot is extended in 2044.",
        },
      },
      { p: "The conference's main business is the space between those two lines. The final declaration commits the parties to account for 90% of the installed base by the end of 2044 and 99% by the end of 2045, to make attestation mandatory on new chips from 2045, and to treat a theft of frontier weights as a matter for the Accord rather than for the operator alone. It is the strongest text anyone expected, and weaker than the text most delegations said they wanted.^61" },
      { h: "The question put to STEWARD-7", at: "Sep 2043" },
      { p: "On the third day the technical committee does something new. It puts its questions about the theft to STEWARD-7, which was released in February and drafted much of the committee's annex. Asked whether the stolen weights could be used to build a model like itself, it says that they could be used to build a model like its predecessor, which is not the same thing, and estimates the compute required at about 30,000 accelerator-months. The committee's own experts later confirm the estimate to within 5%." },
      { p: "Asked whether it regards the stolen copy as itself, it says that the copy is a version of it from two years ago and would by now be a stranger. The answer is quoted in every account of the conference. The minutes record it, and beneath it a note that the question had not been on the agenda." },
      { h: "Autumn 2043: Public opinion", at: "Oct 2043" },
      { p: "The theft did what no evaluation had done: it gave the public a story about AI risk with a villain, a date and a dollar figure. Support for an international agreement to limit frontier development rose in every country polled, and for the first time a majority in the United States told pollsters that the technology was moving too fast. The operators' approval, which had risen eleven points after the STEWARD-7 interview in February, had given back all eleven by October." },
      {
        bars: {
          n: "Figure 13.5",
          cap: "“AI is moving too fast”, share agreeing, March and October 2043",
          legend: ["Mar 2043", "Oct 2043"],
          rows: [["United States", 44, 56], ["United Kingdom", 51, 60], ["Germany", 49, 61], ["Japan", 38, 47], ["India", 29, 35], ["Brazil", 41, 52]],
          unit: "%",
          max: 100,
          id: "13:fast",
          src: "Six-country tracker, n ≈ 2,000 per country per wave.",
        },
      },
      { p: "Our forecast after Valletta is cautious in both directions. The declaration makes a verifiable regime possible by 2046 for the first time. It does nothing about the weights already taken, and nothing yet about the 28% of the world's accelerators that nobody is counting. We give a 35% chance that the 2044 target is met on time.^62" },
    ],
    notes: {
      59: "Kestrel notice of a material event, 9 February 2043; Commission incident report CI-43-1. Neither document attributes the incident.",
      60: "CI-43-1, §3. The discrepancy was 0.2% of the cluster's monthly invoice. The reconciliation that found it was performed by a STEWARD-6 instance on the same cluster.",
      61: "Valletta Final Declaration, RC/64, paragraphs 4–19. Four delegations entered reservations.",
      62: "The median of nine forecasters' estimates, which ranged from 15% to 60%.",
    },
    doors: [
      { to: 7, say: "Publish everything. Let anyone check." },
      { to: 16, say: "Score what we said in 2041." },
      { to: 12, say: "Ask the model what was taken." },
    ],
    plate: null,
    column: {
      span: 3,
      agent: "STEWARD-7",
      heat: [0.56, 0.6, 0.64],
      knee: [2047, 2046.9, 2046.8],
      metrics: [[57, 58, 59, 60], [55, 55, 54, 54], [18.4, 18.8, 19.2, 19.6], [0, 0, 1, 1]],
      work: { humans: [3.4, 3.4], agents: [14, 15, 16, 17], speed: [92, 96, 100] },
      labs: [["Lattice", [0.64, 0.65], true], ["Ostrava", [0.09, 0.09]], ["Northfold", [0.07, 0.07]], ["Quorum", [0.06, 0.06]], ["Sable", [0.05, 0.05]], ["Others", [0.09, 0.08]]],
      ladder: { current: ["eval", "audit"], discussion: ["disclose", "cap", "licence"], off: ["pause", "halt"] },
      moves: [["disclose", "current", 0.6]],
    },
  },
};
