import { describe, expect, it } from "vitest";
import { findForbiddenWords, NARROW_DISCLAIMER, NARROW_FORBIDDEN } from "./narrow-words";

describe("findForbiddenWords", () => {
  it("finds a word and its stem, in list order", () => {
    expect(findForbiddenWords("Log each injection")).toEqual(["injection", "inject"]);
  });

  it("matches Turkish casing", () => {
    expect(findForbiddenWords("İĞNE")).toEqual(["iğne"]);
  });

  it("matches English upper case", () => {
    expect(findForbiddenWords("INJECTION")).toContain("injection");
  });

  it("catches Turkish consonant changes through ilac", () => {
    expect(findForbiddenWords("ilacın")).toEqual(["ilac"]);
  });

  it("reports the list entry, not the text", () => {
    expect(findForbiddenWords("GLP-1")).toEqual(["GLP"]);
  });

  it("matches multi-word entries as phrases", () => {
    expect(findForbiddenWords("Yan etkiler")).toEqual(["yan etki"]);
  });

  it("does not match a different word that merely shares letters", () => {
    expect(findForbiddenWords("dosage")).toEqual([]);
  });

  it("requires a word boundary at the start", () => {
    expect(findForbiddenWords("adozen")).toEqual([]);
  });

  it("allows each disclaimer on its own", () => {
    expect(findForbiddenWords(NARROW_DISCLAIMER.en)).toEqual([]);
    expect(findForbiddenWords(NARROW_DISCLAIMER.tr)).toEqual([]);
  });

  it("still flags words next to a disclaimer", () => {
    expect(findForbiddenWords(`${NARROW_DISCLAIMER.en} Talk to your doctor.`)).toEqual(["doctor"]);
  });

  it("returns nothing for clean text", () => {
    expect(findForbiddenWords("Weight, food and water")).toEqual([]);
  });

  it("keeps the list as specified", () => {
    expect(NARROW_FORBIDDEN).toHaveLength(23);
  });

  it("folds line breaks and repeated spaces inside phrases", () => {
    expect(findForbiddenWords("side\neffect")).toEqual(["side effect"]);
    expect(findForbiddenWords("yan  etki")).toEqual(["yan etki"]);
    expect(findForbiddenWords("yan\u00a0\t etki")).toEqual(["yan etki"]);
  });

  it("matches a plain phrase", () => {
    expect(findForbiddenWords("yan etki")).toEqual(["yan etki"]);
  });

  it("finds a word after a non-matching look-alike", () => {
    expect(findForbiddenWords("adozen dose")).toEqual(["dose"]);
  });

  it("flags a word right after the Turkish disclaimer", () => {
    expect(findForbiddenWords(`${NARROW_DISCLAIMER.tr} Tedavi`)).toEqual(["tedavi"]);
  });

  it("removes a disclaimer that is wrapped across lines", () => {
    const wrapped = NARROW_DISCLAIMER.en.replace("not a medical", "not a\nmedical");
    expect(wrapped).not.toBe(NARROW_DISCLAIMER.en);
    expect(findForbiddenWords(wrapped)).toEqual([]);
    const wrappedTr = NARROW_DISCLAIMER.tr.replace("tedavi etmez", "tedavi\n etmez");
    expect(wrappedTr).not.toBe(NARROW_DISCLAIMER.tr);
    expect(findForbiddenWords(wrappedTr)).toEqual([]);
  });

  it("returns nothing for an empty string", () => {
    expect(findForbiddenWords("")).toEqual([]);
  });

  it("normalizes decomposed Unicode", () => {
    expect(findForbiddenWords("ig\u0306ne")).toEqual(["iğne"]);
  });
});
