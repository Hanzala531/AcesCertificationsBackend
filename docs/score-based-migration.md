# ACES Score-Based Migration

## A. What Changed

The ACES certificate evaluation architecture was migrated from a `weightage` model to a pure `score` model.

The old system treated a question as something with relative importance. The new system treats a question as something with a direct numeric value.

Core change:

- old model: `weightage`
- new model: `score`

Question structure now works like this:

- every question has `score`
- boolean questions can also have `yes_score`
- boolean questions can also have `no_score`
- AI-reviewed questions use confidence against the question score
- all certificate totals are now based on `earned_score`, `max_score`, and `final_percentage`

## B. Why It Changed

The old `weightage` approach made score calculation harder to understand because the final result depended on relative weighting formulas.

The new `score` approach was introduced to make the system:

- easier to explain
- easier to audit
- easier to recalculate after AI review changes
- easier to maintain across certificate, AI review, reviewer, and audit flows
- easier to map into badge ranges using final percentage

In short:

- before: "how important is this question compared to other questions?"
- now: "how many points is this question worth?"

## C. What Was Removed

The following weightage-based behavior was removed from active application logic:

- `questions.weightage` usage in runtime code
- weighted formulas like `sum(confidence * weightage) / sum(weightage)`
- DTO fields that exposed `weightage`
- repository writes/reads that depended on `weightage`
- Swagger examples using `weightage`
- AI scoring logic based on weightage aggregation

Historical migrations still mention `weightage` because they are part of schema history, but the live application logic now uses score-based calculation.

## D. What Was Added

### Database fields

- `questions.score`
- `questions.yes_score`
- `questions.no_score`
- `ai_reviews.earned_score`
- `ai_reviews.max_score`
- `ai_reviews.final_percentage`
- `certificate_assessments.earned_score`
- `certificate_assessments.max_score`
- `certificate_assessments.final_percentage`

### Centralized scoring engine

A single centralized service was introduced:

- `ScoreCalculationService`

This service is now the main source for score calculation rules.

Implemented methods:

- `calculateQuestionScore()`
- `calculateBooleanQuestionScore()`
- `calculateAiQuestionScore()`
- `calculateSectionScore()`
- `calculateSubsectionScore()`
- `calculateCertificateScore()`
- `calculateFinalPercentage()`
- `assignBadge()`

## E. How the New System Works

### 1. Base question model

Each question has a base score:

```ts
score: number
```

Valid range:

- `0` to `999`

This is the maximum value of the question for certificate-level calculation.

### 2. Boolean question model

Boolean questions support answer-based scoring:

```ts
yes_score: number
no_score: number
```

These fields are used when the question is manually answered as `yes` or `no`.

Example:

- `score = 10`
- `yes_score = 10`
- `no_score = 0`

Result:

- answer `yes` -> earned score `10`
- answer `no` -> earned score `0`

Another example:

- `score = 10`
- `yes_score = 6`
- `no_score = 2`

Result:

- answer `yes` -> earned score `6`
- answer `no` -> earned score `2`

Important rule:

- `score` is the question's maximum contribution to certificate total
- `yes_score` and `no_score` define what is earned for manual boolean answers

### 3. AI-reviewed question scoring

For AI-reviewed questions, the system now uses this formula:

```txt
earned_score = (confidence_score / 100) * question_score
```

Where:

- `confidence_score` is the AI confidence, usually from `0` to `100`
- `question_score` is the question's base `score`

Example 1:

- question `score = 20`
- AI confidence `80`

Calculation:

```txt
earned_score = (80 / 100) * 20 = 16
```

Final earned score:

- `16.00`

Example 2:

- question `score = 15`
- AI confidence `45`

Calculation:

```txt
earned_score = (45 / 100) * 15 = 6.75
```

Final earned score:

- `6.75`

### 4. Flagged or rejected AI question

If a question is flagged or rejected, the earned score becomes:

```txt
earned_score = 0
```

Example:

- question `score = 25`
- AI confidence `92`
- flagged = `true`

Result:

- earned score `0`

This rule ensures that confidence only counts if the AI result is accepted.

### 5. Manual non-boolean question scoring

For manual non-boolean questions:

- if the answer is valid/present, earned score = `score`
- if the answer is empty/invalid, earned score = `0`

Example:

- `score = 12`
- answer submitted properly

Result:

- earned score `12`

If no answer is submitted:

- earned score `0`

### 6. How `max_score` is calculated

Certificate `max_score` is now based on the sum of question base scores.

Formula:

```txt
certificate_max_score = sum(all question scores)
```

Important clarification:

- `max_score` uses `score`
- it does not use `weightage`
- it does not use weighted percentages
- it does not use `ai_review_score`
- it is the direct total of the question values defined in the certificate

Example:

- Q1 score = `20`
- Q2 score = `15`
- Q3 score = `10`

Then:

```txt
certificate_max_score = 20 + 15 + 10 = 45
```

### 7. How `earned_score` is calculated for the whole certificate

Formula:

```txt
certificate_earned_score = sum(all earned scores)
```

Example:

- Q1 earned = `16`
- Q2 earned = `15`
- Q3 earned = `6`

Then:

```txt
certificate_earned_score = 16 + 15 + 6 = 37
```

### 8. Final percentage formula

The final percentage is:

```txt
final_percentage = (certificate_earned_score / certificate_max_score) * 100
```

The result is rounded to 2 decimal places.

Example:

- certificate earned score = `37`
- certificate max score = `45`

Calculation:

```txt
final_percentage = (37 / 45) * 100 = 82.22
```

Final stored percentage:

- `82.22`

### 9. Badge assignment

Badge assignment remains configuration-based.

The system checks the final percentage against badge ranges:

- `90 - 100` -> Gold
- `70 - 89` -> Silver
- `50 - 69` -> Bronze

Actual ranges still come from certificate badge configuration in the database.

Flow:

1. calculate `earned_score`
2. calculate `max_score`
3. calculate `final_percentage`
4. find badge range where percentage fits
5. assign badge

Badge allocation is handled through:

- `ScoreCalculationService.assignBadge()`

### 10. AI review flow end to end

The AI review score flow now works like this:

1. user submits answers
2. AI evaluates AI-enabled questions
3. AI stores `confidence_score` and flag status
4. for each AI-reviewed question:
   - if flagged -> earned score `0`
   - if not flagged -> `(confidence_score / 100) * score`
5. all question earned scores are aggregated
6. certificate earned score is calculated
7. certificate max score is calculated from all question `score` values
8. final percentage is calculated
9. badge is assigned from percentage range
10. summary fields are persisted in `ai_reviews` and `certificate_assessments`

### 11. Yes/No scoring flow end to end

For manual boolean questions:

1. question is configured with `score`
2. optional `yes_score` and `no_score` are configured
3. user answers `yes` or `no`
4. system maps answer:
   - `yes` -> `yes_score`
   - `no` -> `no_score`
5. earned score is added to certificate total
6. question base `score` still contributes to certificate `max_score`

Example:

- question score = `10`
- yes_score = `10`
- no_score = `4`

If answer is `no`:

- earned = `4`
- max contribution = `10`

This means the user partially earns the question's total possible value.

### 12. Reviewer and admin adjusted flow

When reviewer/admin actions happen:

- recalculation still uses centralized score logic
- final percentage remains the core value for badge selection
- score summary fields remain aligned with certificate result

If a flow stores a reviewer-adjusted final value directly, badge assignment still uses the resulting percentage.

## F. API Impact Summary

### Reused APIs

All existing APIs were preserved where possible:

- certificate APIs
- question create/update APIs
- assessment APIs
- AI review APIs
- reviewer APIs
- audit APIs

No route changes were required for normal migration behavior.

### Modified APIs

The contract changed at the field level where questions are configured or returned:

- `weightage` removed from active payloads
- `score` used instead
- boolean scoring fields available as `yes_score` and `no_score`

Affected API areas:

- certificate question DTOs
- question update DTOs
- certificate response payloads
- assessment question payloads
- Swagger examples

### New APIs

None.

## Updated API Summary

- reused APIs: existing certificate, assessment, AI review, reviewer, and audit endpoints
- modified APIs: request/response bodies that previously exposed `weightage`
- new APIs: none

## Swagger Updates

Swagger was updated to reflect score-based question configuration:

- `score` examples added
- `yes_score` / `no_score` examples retained or updated
- `weightage` examples removed from active DTO documentation
- no new endpoints were introduced

## Migration Safety Notes

- migration keeps a backup of legacy `weightage` values before dropping the old column
- new score summary fields are added safely
- score-based runtime logic reads the new fields after migration
- no existing route flow was intentionally replaced with a new API

## Practical Q&A

### How does AI score count now?

AI score is no longer calculated with weightage.

It now works as:

```txt
earned_score = (confidence_score / 100) * score
```

If the AI confidence is lower, earned score is lower.  
If the AI response is flagged, earned score becomes `0`.

### Does `ai_review_score` decide the final AI earned score?

No. The runtime score calculation now uses the question's base `score` for AI-earned-score calculation.

### How does Yes/No scoring work?

For manual boolean questions:

- `yes` returns `yes_score`
- `no` returns `no_score`

Example:

- score = `10`
- yes_score = `10`
- no_score = `3`

If answer is `no`, the earned score is `3`.

### What is the difference between `score` and `earned_score`?

- `score` = how much the question is worth
- `earned_score` = how much the user actually got

### What is `max_score`?

`max_score` is the total possible score for the certificate.

It is the sum of all question `score` values.

### What is `final_percentage`?

It is the percentage derived from:

```txt
(earned_score / max_score) * 100
```

Rounded to 2 decimal places.

### Can a boolean question give partial score?

Yes.

Example:

- score = `10`
- yes_score = `10`
- no_score = `4`

If the answer is `no`, the user still earns `4`.

### What happens if a user leaves a manual question blank?

- earned score = `0`

### What happens if an AI-reviewed answer is flagged?

- earned score = `0`

### How does badge selection happen?

The system compares `final_percentage` with configured badge ranges and assigns the matching badge.

### Are section and subsection scores still supported?

Yes.

The scoring engine still supports:

- question level
- subsection level
- section level
- certificate level

All of them are built from the same score aggregation model.
