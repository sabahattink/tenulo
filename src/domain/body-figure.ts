/**
 * The body drawn when the user picks an injection site. A display choice, not a record about the
 * person: it only decides which of the two figures the site map shows.
 */
export const BODY_FIGURES = ["female", "male"] as const;
export type BodyFigure = (typeof BODY_FIGURES)[number];

/** The figure until the user picks the other one, above the map itself. */
export const DEFAULT_BODY_FIGURE: BodyFigure = "female";
