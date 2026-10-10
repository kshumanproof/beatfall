# Retention wording, for review

**Decided 10 October 2026 and built.** Kris chose seven years, thirteen months,
and corrections on the financial horizon. The sweep is in `api/cleanup.js` and
the wording below is in the Privacy Policy. Kept as the reasoning. This is the text I would put in the Privacy
Policy and the behaviour I would then build to match it, in that order.

## What changed my mind

I recommended keeping de-identified financial records with no time limit and
you were right to refuse it. Removing an email and a user link makes a record
**pseudonymous**, not anonymous. The account tag still joins a payment amount,
a date and a credit history together, and a set like that can single somebody
out even with no name on it. "We removed the identifiers" is not the same
sentence as "this is no longer about a person", and only the second one earns
an indefinite hold.

So: two schedules, two reasons, and both of them finite.

## 1. Financial records

**What:** the payments ledger and the credit ledger. Amounts, dates, currency,
whether a payment succeeded or failed, credits charged and returned.

**Why it outlives the account:** deleting an account must not erase the fact
that money moved. A refund request, a chargeback, a tax return and an audit
all ask what was collected, and none of them can be answered from an account
that no longer exists.

**Proposed hold:** seven years from the transaction date.

**What happens at deletion:** the email and the link to the user record are
removed immediately. What remains is the amount, the date, the currency, the
outcome and an opaque tag. The tag is random, never derived from an email, and
cannot be reversed into one.

**What happens at seven years:** the row is deleted outright.

**Proposed Privacy Policy text:**

> **Payment and credit records.** When your account is deleted we remove your
> email address and the link between you and your payment history straight
> away. We keep the amounts, dates and outcomes of payments and credit
> movements for seven years, with a reference that is not derived from your
> name or your email. We keep them because tax and accounting rules require a
> record of money received and returned. After seven years these records are
> deleted. We cannot use them to contact you, and we do not use them for
> marketing or analysis about you.

## 2. Security and administrative records

**What:** the admin audit trail, cost and problem alerts, grouped issues, and
support cases.

**Why it is different:** these exist to explain a decision while it can still
be questioned, and to show who did what to an account. That is a short horizon.
Nobody in 2033 needs to know which account a cost alert was about in 2026.

**Proposed hold:** thirteen months from the record, then deleted outright.
Thirteen rather than twelve so a full year is always comparable to the year
before it.

**What happens at deletion of an account:** the link to the user is removed at
once, the same as above. The rest of the record is kept to the thirteen-month
horizon and then deleted.

**One exception worth stating:** an administrative action taken ON an account,
such as correcting credits, is kept for the financial horizon rather than the
operational one, because it changed a balance and a balance has to be
explicable for as long as the money is.

**Proposed Privacy Policy text:**

> **Service and support records.** We keep records of problems, cost alerts,
> support conversations and administrative actions for thirteen months, so we
> can explain what happened and why a decision was made. When your account is
> deleted we remove the link between you and these records immediately, and
> the records themselves are deleted after thirteen months. Where an
> administrative action changed your credit balance, we keep that record with
> our payment records instead, under the seven year rule above.

## 3. What is not covered by either, and already decided

Unchanged and listed only so the three can be read together:

- **Your writing.** Deleted with the account. Nothing in these records holds a
  card, a note, an outline, a title, a filename or anything typed into
  Beatfall.
- **Pictures.** Deleted with the account, and thirty days after a plan ends.
- **Accounts that go quiet.** Deleted after six months with no sign-in and no
  live subscription, with one warning at five months.

## What I need from you

Three figures, and then I will build the sweeps and update the Privacy Policy
in the same change:

1. Seven years for financial records, or a different number.
2. Thirteen months for operational records, or a different number.
3. Whether an administrative credit correction follows the financial horizon,
   which is what I have proposed, or the operational one.

Until you answer, nothing is deleted on a schedule and nothing is promised in
the Privacy Policy that the code does not do.

## One thing to check with somebody who is not me

Seven years is the ordinary figure for business records in the United States
and it is the one most small companies use, but I am not an accountant and
Georgia may have its own view. The number is easy to change later; the Privacy
Policy saying one thing while the code does another is not. Worth one question
to whoever does your books before this ships.
