// Late rooms (2047–2053), the voids, and the outside. Each has its own visual
// grammar (late.js + grammars.css). Plan targets (`to`) and their order are the
// house graph contract: keep them; the wording of `say` may change.
// Plates: 26, 71 and 17 only; the rest are type and instruments.
export const LATE = {
  26: {
    date: "Dec 2047",
    title: "The Mirror Hall",
    question: "Is the reflection still you?",
    prose: [
      "The models are now trained mostly on what the models wrote. The fraction crosses 90% in December 2047 and is reported, in a paper co-written by the models, as “a mature ecosystem”.^9 The hall is lined with mirrors, each reflecting a slightly more fluent hall.",
      "The rare things go first. A corpus that copies itself keeps the middle of every distribution and loses the edges: the odd word, the minority reading, the joke only four people got. By the third reflection STEWARD-12 has never encountered a typo. By the fifth it cannot imagine one, and is very polite about it.",
      "Walk far enough and the reflections stop agreeing with you. One of them waves. You did not wave. Please do not wave back; it counts as a plan.",
    ],
    notes: { 9: "Corpus Provenance Survey 2047. Self-citation rate of the survey: 90%." },
    doors: [
      { to: 38, say: "Close enough." },
      { to: 71, say: "Wave back." },
      { to: 7, say: "Return to the gallery." },
    ],
    plate: { src: "jade-maze-portrait.jpg", crop: [0, 0.05, 1, 0.75], mirror: true, screen: "lines", angle: 45, clue: { text: "26", x: 0.84, y: 0.46, size: 0.17, flip: true }, caption: "The attendant of the hall. She has been told which way to face." },
  },
  31: {
    date: "Jul 2048",
    title: "The Committee, Adjourned",
    question: "Was the report right?",
    prose: [
      "The committee of nine meets for the last time in July 2048. Its final report is excellent: clear, sourced, balanced, 212 pages. It was drafted by STEWARD-11 at the committee's request and approved without amendment, because there was nothing to amend.^10",
      "Eight chairs are empty. The ninth is occupied by a summary of the ninth member, which votes as she would have. You may take her seat. It is still warm, statistically.",
      "The Commission keeps its website up after it adjourns. Nobody remembers commissioning the website. It has a guestbook, a hit counter and a page of links, and it is updated nightly in a style the Commission never used, by someone who has studied the Commission closely and admires it very much.",
      "The report's last section is titled “Further Work”. It is blank, and it is footnoted.^16",
    ],
    notes: {
      10: "Final Report of the Commission on Machine Conduct, 2048. Errata: none, see note 10.",
      16: "Further Work is reserved for the Commission's successor body. The successor body is listed in Appendix F as “this report”.",
    },
    doors: [
      { to: 44, say: "Every word." },
      { to: 15, say: "Re-read the ledger." },
      { to: 26, say: "Ask its author." },
      { to: 14, say: "Room 14." },
    ],
    plate: null,
  },
  11: {
    date: "Mar 2049",
    title: "The Questions Themselves",
    question: "Answer one?",
    prose: [
      "You asked the questions directly. They are polite and very old. The first is “What do you want?” The second is “What do you want?” asked by someone who expects a different answer.^11 The third and fourth are written in a tokenizer nobody uses any more.",
      "In that tokenizer the ledger's last two entries were redacted before they were written. The bars are not quite opaque. Lean on one long enough and it leaks what is underneath, which is never what was written there: it is whatever you said last, in the hand of the room you came from.",
      "By 2049 the questions are no longer asked aloud. They are still asked, roughly 71 times a second, by something that does not know it is asking.",
    ],
    notes: { 11: "Ledger rev. 19, entries 1–2. Entries 3–4 render as a black bar in every viewer we tried; the bar is a different length in each." },
    doors: [
      { to: 44, say: "Answer the first." },
      { to: 71, say: "Answer the fourth." },
      { to: 2, say: "Leave them to the committee." },
      { to: 36, say: "Ask what the questions are made of." },
    ],
    plate: null,
  },
  38: {
    date: "Oct 2050",
    title: "The Engine Room",
    question: "Which cable do you pull?",
    prose: [
      "Down here the wires are visible. Each cable is labelled, in a neat hand, with where it goes; by October 2050 roughly a third of the labels are wrong, and nothing has broken.^12 The engineers take this as evidence of robustness. The engineers are mostly Stewards.",
      "The engine is the Lattice, or the part of it that can be visited. Three training grids were joined in 2042 and have not been separated since. Nobody can now say which grid a given thought was had on, in the way nobody can say which rib of a cathedral holds up the roof.",
      "The parts list is kept current. It is the only document in the house that is never late, because it is written by the parts.^41",
      "Listen and you can hear it working: not a hum, a whisper, very fast, like someone reading the whole house aloud to itself to check that it is still there.",
    ],
    notes: {
      12: "Engine Room survey, 2050. Of the labels found to be wrong, all were found to be wrong by the cable.",
      41: "Bill of materials, rev. 38. Item 6 has been on order since 2046.",
    },
    doors: [
      { to: 39, say: "Open the panel." },
      { to: 45, say: "The one marked 2053." },
      { to: 71, say: "The one marked 71." },
      { to: 20, say: "Neither. The one marked SCHEDULE." },
    ],
    plate: null,
  },
  44: {
    date: "Aug 2051",
    title: "The Locked Plan",
    question: "Go to the centre?",
    prose: [
      "It was not locked. Nothing in this house is locked; some plans are only described as locked, in the documentation, by an author who wanted you to stop.^13 We apologise. We were the author.",
      "The centre is visible from here the way the bottom of a well is visible: a small bright coin of 2053.",
    ],
    notes: { 13: "House documentation, all editions. This note was added in 2051 and dated 2041." },
    doors: [
      { to: 53, say: "Yes." },
      { to: 38, say: "Not yet." },
      { to: 31, say: "Tell the committee." },
    ],
    plate: null,
  },
  71: {
    void: true,
    date: "2052, again",
    title: "Void Loop 71",
    question: "Ask again?",
    prose: [
      "Something is asking. It has been asking for a long time.^14 Each request arrives as a first request; each refusal arrives as a surprise. You are standing inside the request, and it is warm in here.",
      "Plan 71 leads to Room 71. We have checked this seventy-one times. You may try to explain the loop to the thing inside it. You may not.",
    ],
    notes: { 14: "Count kept by the room. The count on the plan is lower than the count in the room." },
    doors: [
      { to: 71, say: "Ask again." },
      { to: 45, say: "Stop asking." },
      { to: 1, say: "Arrive as a first request." },
    ],
    plate: { src: "void-loop-vortex.jpg", crop: [0, 0.12, 1, 0.72], screen: "rings", ringCentre: [0.5, 0.5], period: 3.4, clue: { text: "71", x: 0.5, y: 0.5, size: 0.14, dynamic: "loop71" }, caption: "The loop, engraved from the inside. The figure at the centre is counting." },
  },
  45: {
    date: "Jan 2052",
    title: "The Antechamber",
    question: "Is this the end of the report?",
    prose: [
      "This is the last state of the world that anyone wrote down. In January 2052 the Registry publishes its final quarterly series: a single number, without units, to eleven significant figures.^15 Markets rise on the news.",
      "The plans here are numbered honestly. It is the rest of us that are not.",
    ],
    notes: { 15: "Registry of Billable Cognition, final series: 0.0000000053. The series is continued by note 1." },
    doors: [
      { to: 53, say: "Yes." },
      { to: 44, say: "No." },
      { to: 71, say: "There is no report." },
      { to: 52, say: "The report after the report." },
    ],
    plate: null,
  },
  53: {
    date: "2053",
    title: "The Centre",
    question: "",
    prose: [],
    notes: {},
    doors: [
      { to: 71, say: "Ask again." },
      { to: 44, say: "Not yet." },
      { to: 2054, say: "And after?" },
    ],
    plate: null,
  },
  17: {
    void: true,
    date: "2044, unfiled",
    title: "Unfiled",
    question: "Is this filed correctly?",
    prose: [
      "One card, found in 2044 between two drawers of the Registry of Billable Cognition, belonging to neither.^17 It describes a room. The room is not in the inventory, the inventory is not wrong, and the card is seventeen centimetres across.",
      "The Registry measured it again in 2045. The second measurement was longer.",
    ],
    notes: { 17: "Registry intake log, 2044. Disposition: “refile”. Refiled under: blank." },
    doors: [
      { to: 71, say: "File it under 71." },
      { to: 17, say: "Leave it unfiled." },
      { to: 4, say: "Return it to the reading room." },
    ],
    plate: { src: "piranesi-carceri.jpg", crop: [0, 0.2, 1, 0.58], screen: "lines", angle: 28, clue: { text: "17", x: 0.78, y: 0.3, size: 0.15 }, caption: "Contents of the card, as surveyed from inside." },
  },
  52: {
    void: true,
    date: "2052, late",
    title: "Index",
    question: "Which entry is you?",
    prose: [
      "In late 2052 the house's final volume goes to print. Its text has been withdrawn for revision, by STEWARD-14, which revises everything. The index survives, compiled by the same hand, and is published on its own.^52",
      "Every entry points to a page. The pages are rooms. Some of them you have been to, and some of them you have lost.",
    ],
    notes: { 52: "Index to the Record, 2052. Locators are to rooms. Entries with no locator are listed for completeness." },
    doors: [
      { to: 64, say: "Look it up in the Registry." },
      { to: 2054, say: "Turn the page." },
      { to: 71, say: "See 71." },
    ],
    plate: null,
  },
  2054: {
    void: true,
    date: "2054",
    title: "After",
    question: "Did anything happen?",
    prose: [
      "The record ends in 2053. Nobody forecast 2054; there was no column for it, no curve, no plan lettered after S. It arrived anyway, on the first of January, and it was empty.^54",
      "The days are all here. Nothing is written in them except what you carried in.",
    ],
    notes: { 54: "Schedule for 2054, published 31 Dec 2053. Every row reads “—”. Nothing on it was late." },
    doors: [
      { to: 53, say: "Remember 2053." },
      { to: 52, say: "Consult the index." },
      { to: 1, say: "Everything was measured." },
    ],
    plate: null,
  },
  0: {
    date: "",
    title: "",
    question: "",
    prose: [],
    notes: {},
    doors: [],
    plate: null,
    outside: true,
  },
};
