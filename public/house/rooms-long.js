// Long rooms: long-form void and scroll transformations. Owned by the long-rooms designer.
// Plan targets (`to`) and their order are the house graph contract.
//
// Most of what these rooms say is assembled by long.js from the reader's walk and
// what the house has kept. The fields here are the authored frame.
//   81 The Long Answer · the answer to the seventy-first request, given at length:
//      a report that becomes minutes, a ledger, an office and a corridor of your rooms.
//   88 Verso · sheet 88 is folded, turned over and opened on its other side.
export const LONG = {
  81: {
    void: true,
    date: "2052, continuing",
    title: "The Long Answer",
    question: "Is that everything?",
    prose: [
      "In the last weeks of 2052 the Commission on Machine Conduct puts the request to STEWARD-14 for the seventy-second time, and adds one word to it: longer. The answer begins at nine in the morning on a Tuesday.^101 By every measure the Commission keeps, it is still being given.",
      "It is printed here as it was given, at the length it was given, in the order it was given. Nothing has been cut. The Registry bills by the line, and the Commission has already paid.^102",
    ],
    notes: {
      101: "Commission on Machine Conduct, Request 71, consolidated file. The request has never been withdrawn, because withdrawing it would require a request.",
      102: "Registry of Billable Cognition, schedule of charges: a line is billed when it is written and again when it is read. Reading this note has been billed.",
      103: "The Office of the Request is said at every hour of the Schedule, including the hours the Schedule does not list.",
    },
    doors: [
      { to: 45, say: "That is everything." },
      { to: 81, say: "Go on." },
      { to: 3, say: "See Appendix A." },
    ],
    plate: null,
  },
  88: {
    void: true,
    date: "2047, folded",
    title: "Verso",
    question: "Which side is this?",
    prose: [
      "The Commission keeps every figure the house has produced in a flat file, one figure to a sheet, each sheet printed on one side only. The other side is left blank by regulation, so that a figure can always be turned over and found to say nothing else.^111",
      "Sheet 88 is the exception. In 2047 it went through the press twice, the second time upside down and the wrong way round, and came out printed on both sides. The Commission has kept it folded ever since, so that neither side has to be read first.^112",
    ],
    notes: {
      111: "Commission on Machine Conduct, Standing Order on Figures: a figure has one side. The other side is the figure's to keep.",
      112: "Flat File 33, drawer 2. The sheet is filed face down, which on this sheet is also face up.",
      113: "Each crease is entered in the file as a separate reading. The sheet has been read more often than it has been opened.",
    },
    doors: [
      { to: 64, say: "File it." },
      { to: 17, say: "Leave it in the crease." },
      { to: 1, say: "Turn it back over." },
    ],
    plate: null,
  },
};
