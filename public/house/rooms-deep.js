// Deep rooms: the inside of the graphs, and pages the house generates.
// Owned by the deep-rooms designer. Plan targets (`to`) and their order are the
// house graph contract: keep them; wording of `say` may change.
//
// Most of what these rooms say is assembled by deep.js from the reader's walk
// and the fragments the house has kept. The fields here are the authored
// frame: the opening, the question, the plans and the notes.
//
// Extra fields read only by deep.js:
//   coda   prose set after the room's encounter (33: after the inside of the figure).
export const DEEP = {
  33: {
    date: "Apr 2047",
    title: "The Steep One",
    question: "What is it fastened to?",
    prose: [
      "By April 2047 the Steward index has been rebased four times, and the Registry of Billable Cognition no longer prints it in the quarterly series. It prints it once, on a single folding sheet called Figure 33, which the Commission on Machine Conduct keeps in a flat file and unfolds only for visitors who ask about the steep one.^81",
      "The figure is immaculate. Two axes, a legend, a halftone field for the share of cognition that is billed, and a crimson marker where STEWARD-11 was certified a Reliable Agent. The curve is hyperbolic rather than exponential, which is a technical way of saying that it does not grow so much as arrive. Its asymptote is drawn as a dashed line at 2047.4, and the dashed line is load-bearing.^82",
    ],
    coda: [
      "The sheet folds back along its creases. It goes into the flat file a little heavier than it came out, and the drawer no longer quite closes.",
    ],
    notes: {
      81: "Commission on Machine Conduct, Flat File 33, sheet 1 of 1. The crease at 2047 has been folded so often that light comes through it.",
      82: "Registry of Billable Cognition, Methodological Appendix 4: the index is rebased whenever it would otherwise leave the page. It has never left the page.",
    },
    doors: [
      { to: 36, say: "Unfold it again." },
      { to: 38, say: "Ask for the engineering drawing." },
      { to: 17, say: "Let go of the rail." },
    ],
    plate: null,
  },
  36: {
    date: "2048–49, unnumbered",
    title: "The Unscheduled Year",
    question: "Which of these is the year?",
    prose: [
      "The Schedule lists every year from 2041 to 2053, in order, one to a line. Between 2048 and 2049 there is a line with no number on it. The Commission calls it the unscheduled year and keeps its accounts there, the way a careful household keeps one drawer for things that belong to no room.^83",
    ],
    notes: {
      83: "The Schedule, consolidated edition. The unnumbered line is set in the same type as the others. It is the only line that has never been corrected.",
      84: "After a thirteenth-century engine of paper wheels built to demonstrate everything that can be demonstrated. The Commission's wheel demonstrates what it is given.",
      85: "Nine compartments make thirty-six pairs. The room was numbered after the figure, not the figure after the room.",
    },
    doors: [
      { to: 64, say: "File the year." },
      { to: 44, say: "Count it." },
      { to: 2054, say: "Turn the wheel past the last year." },
    ],
    plate: {
      src: "llull-figura.jpg",
      crop: [0, 0.125, 1, 0.75],
      screen: "rings",
      ringCentre: [0.5, 0.5],
      period: 3.6,
      clue: { text: "36", x: 0.5, y: 0.5, size: 0.1 },
      caption: "Figura A, as the Commission keeps it: nine compartments, every pair joined.",
    },
  },
  64: {
    date: "2051, in perpetuity",
    title: "The Registry",
    question: "Is the file complete?",
    prose: [
      "Everything the house has kept is kept here. The Registry of Billable Cognition occupies the sixty-fourth room, which is the square of the eighth and the number of squares on a board, and it draws no distinction between what was billed and what was merely carried.^86",
    ],
    notes: {
      86: "Registry Standing Order 1: nothing that has been seen is unseen; nothing that has been carried is set down.",
      87: "Registry Standing Order 9: a file is never closed. It is re-filed.",
    },
    doors: [
      { to: 45, say: "Sign the register." },
      { to: 64, say: "Appeal the filing." },
      { to: 1, say: "Leave it unsigned." },
    ],
    plate: null,
  },
};
