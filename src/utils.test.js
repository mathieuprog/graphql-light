import { areArraysEqual, areObjectsEqual } from './utils';

test('object equality', () => {
  expect(
    areObjectsEqual(
      { b: null, c: { d: 1, e: "world" }, a: "foo" },
      { a: "foo", b: null, c: { e: "world", d: 1 } }
    )
  ).toBeTruthy();

  expect(
    areObjectsEqual(
      { b: null, c: { d: [2, 5, 1, 0, {c: 3, d: 4}], e: "world" }, a: "foo" },
      { a: "foo", b: null, c: { e: "world", d: [{d: 4, c: 3}, 1, 0, 2, 5] } }
    )
  ).toBeTruthy();
});

test('array equality', () => {
  expect(
    areArraysEqual(
      [{ b: null, c: { d: 1, e: "world" }, a: "foo" }, "foo"],
      ["foo", { a: "foo", b: null, c: { e: "world", d: 1 } }]
    )
  ).toBeTruthy();

  expect(
    areArraysEqual(
      [1, { b: null, c: { d: [2, 5, 1, 0, {c: 3, d: 4}], e: "world" }, a: "foo" }],
      [{ a: "foo", b: null, c: { e: "world", d: [{d: 4, c: 3}, 1, 0, 2, 5] } }, 1]
    )
  ).toBeTruthy();
});
