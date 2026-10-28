# Acceptance criteria

One JSON file per Jira story, named after its key (`SCRUM-18.json`). The test
dashboard uses these files to show which acceptance criteria (ACs) are met.
Full details are in TECH_SPEC section 15.

```json
{
  "story": "SCRUM-18",
  "title": "Create Household screen",
  "criteria": [
    { "id": "AC1", "text": "As written in Jira", "verify": "test" },
    { "id": "AC2", "text": "As written in Jira", "verify": "manual", "note": "Visual; shown in the UI demo" }
  ]
}
```

- `id`: `AC1`, `AC2`, ... in the order the story lists them.
- `text`: the criterion exactly as written in Jira.
- `verify`: `test` if an automated test proves it, `manual` if it's shown some
  other way (for example, a visual check in a demo). Add a `note` saying how.

## Tagging tests

Tag each test that proves an AC with the story key, and start its name with
the AC id:

```ts
describe("POST /api/households", { tags: ["SCRUM-18"] }, () => {
  it("AC1: creates a household with the creator as its owner", async () => {
    // ...
  });
});
```

- Tags set on a `describe` apply to every test inside it.
- One test can cover several ACs: `"AC1, AC3: ..."`.
- Only tests that prove an AC get the `ACn:` prefix. Supporting tests keep plain names.
- Write the test from the AC text, not from the code. If the code doesn't meet
  the AC, the test should fail.

Vitest only accepts tags that have a file here, so a mistyped key fails the run.
`npm run test:report` checks the rest: an `ACn:` test with no story tag, or an
AC id that isn't in the story's file.
