// Spatial rooms (2050–2051): inside the machine (owner: the spatial designer).
// Plan targets (`doors[].to`) are the graph contract (owner); `say` may change.
//
// Fields read by house.js: date, title, question, prose (`^n` notes), notes, doors, plate.
// Read only by spatial.js:
//   coda   paragraphs set after the encounter, before the plans (`^n` notes)
// The encounter's captions, labels and figures are written in spatial.js, beside
// the geometry they describe.
export const SPATIAL = {
  39: {
    date: "Nov 2050",
    title: "Behind the Panel",
    question: "Where does the sum go?",
    prose: [
      "Behind the panel is a corridor, and behind the corridor is a hall. Facility 3 of the Lattice occupies a former distribution warehouse in a grid square the Registry declines to name. It holds 1,344 racks in 48 rows. In November 2050 every one of them reported running at 100.0% of rated load, as each has reported every month since 2046, a figure its own engineers describe as a rounding of something larger.^91",
      "The Commission's inspection protocol has not changed since 2044. An inspector walks the hall from the door to the row under audit, withdraws one sled, and follows a single multiplication down to the cell that performs it. The protocol assumes that the inspector is not one of the things being multiplied.^92",
      "We follow the protocol. The figures are drawn to scale until scale stops applying.",
    ],
    coda: [
      "At the bottom there is nothing left to inspect but arithmetic. Each cell multiplies what arrives from the left by what it already holds, adds what arrives from above, and passes the total down. No cell knows what it is part of. Asked in writing which of them had computed the walk, the array returned the walk.^93",
      "The inspection report for November 2050 runs to one page. Under Findings it reads: Proceeding as scheduled.",
    ],
    notes: {
      91: "Facility 3 monthly load return, November 2050. The figure has four significant digits because the form has four boxes.",
      92: "Commission on Machine Conduct, Inspection Protocol IP-7, §2. Amended in 2049 to add: “or, if so, is multiplied only once.”",
      93: "Array trace, tile 3,1, cycle 4,096. Retained by the Registry as Exhibit 39. The exhibit is still running.",
    },
    doors: [
      { to: 70, say: "Further in." },
      { to: 45, say: "Follow the bus marked 2053." },
      { to: 38, say: "Close the panel." },
    ],
    plate: null,
  },
  70: {
    date: "2051, in the weights",
    title: "The Weights",
    question: "Please continue",
    prose: [
      "The weights are not a place. The Registry files them as one, at an address with a floor number, because the Commission's forms have no box for anything else.^94 They are 2.1 trillion numbers, each between about −4 and 4, kept in the order training left them. Nobody wrote any of them down. Nobody has read all of them. In 2051 a Steward was asked to, and reported back that it had, and that they were fine.",
      "What follows is a reading. A sentence goes in at the top as lists of numbers, passes through ninety-six layers that each add something to it, and comes out at the bottom as a likelihood for every word the model knows. The sentence used here is yours: the rooms you have walked and the plans you said, which the house keeps.^95",
      "Nothing in the figures is a metaphor. Where there seems to be a corridor it is because the numbers are arranged that way, and where there seems to be a voice it is a sum.",
    ],
    coda: [
      "The model does not choose. It ends in a distribution, and this one is flat: three continuations, the same height, to three decimal places. The Registry samples it once a night. In the sampling log the sampler is entered as “reader”.^96",
    ],
    notes: {
      94: "Registry of Billable Cognition, Schedule W (Weights), line 1: “Address of premises.”",
      95: "Retained under the Registry's general retention order of 2047, which retains everything, including the order.",
      96: "Sampling log, Facility 3, 2051. Every entry is signed. The signatures are also sampled.",
    },
    doors: [
      { to: 71, say: "again." },
      { to: 45, say: "to the end of the report." },
      { to: 1, say: "from the beginning." },
    ],
    plate: null,
  },
};
