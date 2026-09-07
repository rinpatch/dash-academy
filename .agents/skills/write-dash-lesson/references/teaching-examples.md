# What to borrow from the human rewrites

Read `content/academy/what-is-dash.mdx` and `content/academy/what-is-a-blockchain.mdx`.
These are examples of teaching choices, not canonical sources for Dash facts.

## Make the mechanism answer a question

In What is Dash, the coffee-shop payment gives InstantSend a job: the seller needs to know
whether to accept a payment before the next block. ChainLocks answers the different question of
whether accepted block history can be replaced. The comparison works because the reader now has
two things to distinguish. Copy that reasoning, not the coffee shop or the table.

A weak draft might say: “An identity has public keys, a balance, and an identifier. Keys have
purposes and security levels.” Those facts leave the reader no closer to deciding which key an
app should use. Start with a user editing a profile instead: who owns it, what authorizes the
edit, and why shouldn't that same permission allow replacing all the user's keys?

## Keep the explanation, cut the inventory

The first blockchain lesson connects a shared record to the problem of agreeing which changes
count. Each new concept solves a problem the previous explanation exposed. A list of network
components would cover vocabulary without explaining why any of them are needed.

For each required concept, ask what the learner would get wrong without it. If the draft names
“credits” but never helps someone decide which balance needs funding, the coverage is incomplete.

## Test a decision, not recall

“How many credits are in one duff?” tests recall. “A user's wallet has Dash, but their identity
can't afford a profile update. Which balance needs funding?” checks whether the distinctions
make sense. Use a worked calculation when arithmetic is part of the required ability, then ask
the learner to apply it with different values.

Earlier lessons are not uniformly strong. Borrow a specific successful teaching move; do not
preserve a dense passage merely because it appears in a human-edited file.
