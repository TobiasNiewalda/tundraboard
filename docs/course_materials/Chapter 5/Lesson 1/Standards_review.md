MEMO
FROM: Senior Engineering Manager
TO: TundraBoard Team / Course Authors
SUBJECT: Roast & Review: AI_Standards.md
Listen, I’ve seen a lot of "AI Guidelines" in the last two years. Most of them are either toothless suggestions or bureaucratic nightmares that developers ignore the second they hit Cmd+S. 
This document is a decent start, but it’s currently written like a Compliance Manual, not an Engineering Standard. It focuses heavily on what tools to use and what not to do, but it’s dangerously thin on the how and the why of maintaining a high-quality codebase in the age of LLMs.
Here is the roast.
1. The "Budget" Absurdity (Lines 17-21)
You have "token caps" and "prompt limits per developer per day" in a standards document. Are you kidding me?
- The Roast: This isn't a high school data plan from 2005. Capping a developer to 10 "reasoning" prompts a day is a productivity death sentence. If a developer is stuck on a complex PostgreSQL optimization, they aren't going to stop because they hit their "daily quota"—they're going to use their personal account, bypass your security controls, and leak data because your official policy is hindering their ability to actually ship code.
- The Fix: Get rid of the arbitrary caps. Move "Budget" to a separate internal cost-tracking doc if you must, but don't put it in the Engineering Standards. Measure efficiency by PR quality and cycle time, not by how many tokens a dev burned.
2. The "Human-in-the-Loop" Platitude (Line 65)
"All AI-generated code must be reviewed by a human."
- The Roast: This is a "feel-good" sentence that provides zero actual protection. We already review all code. The problem isn't that a human reviews it; the problem is Reviewer Fatigue. When a dev submits a 500-line PR of AI-generated boilerplate, the human reviewer usually just skims it and LGTMs it because it "looks" correct. 
- The Fix: Define AI-Specific Review Heuristics. Instead of saying "review it," tell the reviewer what to look for: 
- "Check for hallucinated library methods."
- "Verify that the AI didn't introduce a subtle race condition in the Prisma transaction."
- "Ensure the AI didn't 'simplify' a complex business rule into a generic one."
3. The "Disclosure" Theater (Line 66)
Tagging AI-generated sections in PR descriptions.
- The Roast: This is pure theater. In two weeks, every single PR will have an [AI-Generated] tag. It becomes noise. It doesn't tell me if the code is good or bad, only that the dev used a tool.
- The Fix: Shift the focus from origin to ownership. The standard should be: "The author owns the code, regardless of the tool. If it breaks, 'the AI did it' is not a valid excuse." Stop tracking the tool; start enforcing the outcome.
4. The "Abstraction" Fantasy (Lines 40-44)
Asking devs to manually replace workspace_id_abc123 with [WORKSPACE_ID] before prompting.
- The Roast: This is a manual process that will be ignored 90% of the time. Developers are in a flow state; they aren't going to spend 5 minutes sanitizing a snippet for a 10-second prompt.
- The Fix: If you’re worried about IP and PII, invest in automated sanitization tooling or a private LLM gateway (like an internal proxy) that scrubs PII before it hits the provider. If you can't do that, accept the risk and focus on the "Never Prompt" list.
5. Missing: The "AI Debt" Strategy
You have a section on "Incident Response," but no section on AI Technical Debt.
- The Roast: You're inviting a flood of "technically correct but architecturally incoherent" code into your repo. AI is great at writing functions, but terrible at maintaining a long-term architectural vision. You are creating a codebase that will be a fragmented mess of "AI-style" patterns within six months.
- The Fix: Add a section on Architectural Alignment. 
- Mandate that AI-generated refactors must be justified against the existing design patterns.
- Define "AI-Debt" as code that works but violates the project's long-term architectural goals, and schedule "Cleanup Sprints" specifically to prune AI-generated bloat.
Final Verdict
Current State: A set of rules for a cautious librarian.
Goal State: A framework for a high-velocity engineering team.
Stop policing the tokens and start policing the architecture.