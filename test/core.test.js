import { test } from "node:test";
import assert from "node:assert/strict";
import { nps, responseInput, surveyInput, toCsv, DEMO, InputError } from "../lib/core.js";

test("NPS is promoters minus detractors, as a whole percent", () => {
  const r = nps([10, 9, 8, 7, 6, 0]);
  assert.equal(r.promoters, 2);
  assert.equal(r.passives, 2);
  assert.equal(r.detractors, 2);
  assert.equal(r.score, 0);
  assert.equal(nps([10, 10, 9]).score, 100);
  assert.equal(nps([0, 3, 6]).score, -100);
  assert.equal(nps([]).score, null, "no answers is no score, not zero");
  assert.equal(nps([9, 9, 9, 6]).score, 50);
  assert.equal(nps([7, 8]).average, 7.5);
});

test("responses need a whole score from 0 to 10", () => {
  assert.equal(responseInput({ score: "0" }).score, 0);
  assert.equal(responseInput({ score: 10, again: "yes" }).again, "yes");
  for (const bad of [-1, 11, 7.5, "", "ten", null]) assert.throws(() => responseInput({ score: bad }), InputError);
  assert.throws(() => responseInput({ score: 5, again: "sometimes" }), /yes, maybe or no/);
  assert.throws(() => responseInput({ score: 5, worked: "x".repeat(501) }), /500/);
});

test("the extra answer is kept only when the survey asks it", () => {
  assert.equal(responseInput({ score: 5, answer: "hi" }).answer, "");
  assert.equal(responseInput({ score: 5, answer: "hi" }, { hasQuestion: true }).answer, "hi");
});

test("surveys need an event name", () => {
  assert.deepEqual(surveyInput({ event: "  Demo  Day " }), { event: "Demo Day", question: "" });
  assert.throws(() => surveyInput({ event: "" }), /event name/);
});

test("CSV quotes cells and defuses spreadsheet formulas", () => {
  const csv = toCsv([["score", "comment"], [9, '=HYPERLINK("x")'], [5, 'said "hi"']]);
  assert.equal(csv, '"score","comment"\r\n"9","\'=HYPERLINK(""x"")"\r\n"5","said ""hi"""');
});

test("demo answers are valid responses", () => {
  for (const [score, worked, change, answer, again] of DEMO.answers) responseInput({ score, worked, change, answer, again }, { hasQuestion: true });
  assert.ok(DEMO.answers.length >= 10);
});
