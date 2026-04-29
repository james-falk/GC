# Objection Cheat Sheet

For when prospects push back. Each objection: **What they say** → **What you say** → **What you do NOT say**.

Use as your reference; don't read from it on the call.

---

## 1. "How is this different from Procore?"

**They mean:** Are you trying to compete with the 800-lb gorilla we've all heard of?

**Say:** "Procore is great — if you're $50M+ in revenue, have a dedicated implementation team, and can absorb $40K+ a year. We built this for the band Procore prices out: $5M–$50M GCs who run on QuickBooks and shouldn't have to learn a Project Management ERP just to do a pay app cycle. Different ICP, different scope, different price point."

**Do NOT say:** "Procore is bloated and slow." Slamming the incumbent makes you sound defensive. Stay above.

---

## 2. "We already use Cantina / GCPay / Textura."

**They mean:** Why should I switch? My team is already trained.

**Say:** "Cantina and GCPay generate pay apps cleanly — that part's solved. What they don't do is propagate change orders to your subcontract ceiling, detect when your SoV has drifted from your contract + COs, or replace the Excel sheet that lives next to them. We sit in that gap. Some customers keep Cantina for a transition period and use us for the SoV + CO + drift layer; others replace it. Your call."

**Do NOT say:** "Cantina is outdated." Their team likely picked it; insulting the choice insults them.

---

## 3. "What about QuickBooks? Are you replacing it?"

**They mean:** I'm not changing my accounting system.

**Say:** "We don't replace it. QuickBooks stays your books of record. We export CSV that imports cleanly into QB today, and we're adding a real two-way API integration in Phase 2. Your CFO/controller's life gets easier, not harder."

**Do NOT say:** "Eventually we'll replace QuickBooks." Even if true; not on the first call.

---

## 4. "Will my subs actually use the portal?"

**They mean:** I have 30 subs across 5 projects. Half of them email PDFs that look like a water bill. There's no way they'll log in to a portal.

**Say:** "Some subs will love it from day one — submitting takes 5 minutes vs. their current half-hour PDF dance. For the holdouts, we're shipping AI extraction in Phase 2: a sub emails their PDF as usual, the system extracts line items and pre-fills the form for your team to review. So you get clean data either way; subs don't have to change anything if they don't want to."

**Do NOT say:** "Your subs will adopt it because it's better." That's optimistic. Acknowledge the friction.

---

## 5. "What about my owner — will they actually log in to approve things?"

**They mean:** My owner is a school district business manager who barely uses email.

**Say:** "Owners and architects don't need to log in. They get an email with a magic link — click, see the document, click Approve or Request Changes, done. No account creation, no password. Mobile-friendly. We tested this pattern; the architect-on-a-jobsite-with-a-phone story works."

**Do NOT say:** "It's just like DocuSign." Reduces a moat to a commodity.

---

## 6. "Is this AIA-compliant? My owner requires AIA forms."

**They mean:** I need the G702/G703 to look right.

**Say:** "The format is AIA G702/G703-compatible. We generate the same line structure your owner expects — original contract sum, net change by COs, contract sum to date, total completed and stored, retainage, current payment due, balance to finish. Cover sheet plus continuation sheet. We don't license AIA's exact published forms because legally we can't — but the format is what your owner reviews against."

**Do NOT say:** "We are AIA forms." That's a trademark issue. Always say "AIA-compatible format."

---

## 7. "What if you go out of business?"

**They mean:** I'm not putting our financial data in something that might disappear.

**Say:** "Fair concern. Three things: full data export at any time — ZIP of CSVs and PDFs, no questions asked, you keep everything. We don't lock you in. Second, all generated documents (pay apps, sworn statements) live as PDFs in your storage; even if the app is gone, your historical records aren't. Third, the company is owner-operated, no investor pressure to flip — we're building this to run for years."

**Do NOT say:** "We won't go out of business." Empty promise.

---

## 8. "How much will this cost long-term?"

**They mean:** I've been burned by SaaS pricing creep.

**Say:** "$799/month flat per firm. No per-seat, no per-project, no usage fees. We do not charge subs to access the portal — that breaks Textura, and we're not making the same mistake. Design partners get pricing locked for life. If we ever change pricing, you're grandfathered."

**Do NOT say:** "Pricing might change as we add features." Even if true; opens a door you don't want open.

---

## 9. "How do we know you'll actually deliver?"

**They mean:** I've watched vendors promise and miss.

**Say:** "Three ways. One: I'll show you the code, the database schema, and the unit tests for the domain logic. Two: I'll commit to a 6-week MVP timeline with weekly demos against your real project shape. Three: cancel anytime in the first 90 days, full refund. If we miss, you walk."

**Do NOT say:** "Trust me." Trust is earned by transparency, not by asking.

---

## 10. "Why should we be a design partner?"

**They mean:** Why am I doing your QA for you?

**Say:** "Three things you get that no later customer will: (a) free 6-month pilot — no payment until month 7. (b) Direct say in the roadmap — your pain points become our priority for Phase 2. (c) Pricing locked at design-partner rate for life. (d) Optionally, named reference customer status — you opt in, on your terms. Most vendors charge customer #1; we're paying you in product attention."

**Do NOT say:** "You're helping us prove the concept." That's true but makes you sound underbaked.

---

## 11. "We're not tech-savvy. We can barely use QuickBooks."

**They mean:** This is going to be hard for my team.

**Say:** "Three of the founders' design partners said the same thing. The portal is mobile-friendly; if your team uses email and the QuickBooks website, they can use this. We onboard you live over Zoom, 1-on-1 with your controller and PMs. White-glove for the first 30 days. Most teams are running their first pay-app cycle in this within a week."

**Do NOT say:** "It's intuitive." Everyone says that. Show, don't tell.

---

## 12. "What if the change order math is wrong?"

**They mean:** I can't have a software bug cost us a payment cycle.

**Say:** "Domain logic — the math — lives in pure functions with high test coverage. Property-based tests check invariants like 'sum of child line items = parent line item' on every commit. The CO propagation is a single atomic database transaction; partial updates can't happen. Plus, every change is logged: you can see who changed what, when, and roll it back if needed."

**Do NOT say:** "It won't be wrong." Anything can be wrong. Acknowledge and explain mitigation.

---

## 13. "Why now? We've been doing this for 20 years in Excel."

**They mean:** Convince me I shouldn't keep doing what works.

**Say:** "Three things converging: (a) the labor pool that knows your Excel tricks is retiring, and the next generation expects software. (b) Your subs are using software for everything else now — the GC office shouldn't be the laggard. (c) Owners — especially institutional owners — increasingly want digital audit trails. The GCs adopting good software in 2026 will run circles around the ones still hand-keying spreadsheets in 2030. You're already the type to take the meeting; that puts you ahead."

**Do NOT say:** "Excel is broken." It's worked for them for 20 years. Respect the journey.

---

## 14. "How big is your team? How long have you been at this?"

**They mean:** Are you a real company?

**Say:** "Right now: founder-led with senior pair-programming via the most advanced AI tooling available. That's it, intentionally. The product surface is bounded enough that 1 + AI is the right team for this stage; once we're at 5+ paying customers, engineer #2 gets hired. Build software lean, sell direct to operators. No fundraising games to play."

**Do NOT say:** "We have a team of 10." Don't lie.

---

## Patterns to listen for

- They keep coming back to a specific pain → you've found their wedge. Anchor on it.
- They're using "we" and "our team" → buying signal (they're including you).
- They ask about pricing more than once → they're seriously evaluating.
- They ask "when could we start?" → close.
- They go quiet for 10 seconds after the demo → they're thinking, not bored. Let them think.

## Patterns to walk away from

- They redirect every question to a competitor (Procore, Sage). They've already committed.
- They have an in-house developer who "could build this in a weekend." Let them.
- The Principal is dismissive, even if the Controller is engaged. Won't get past the gate.
- They keep saying "this is interesting" without ever asking about pricing or timeline. Polite no.
