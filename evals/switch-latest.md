# Follow-up switch evals

5 of 5 counselor follow-ups revised the list and kept the rest of the file.

Ran 2026-09-16T18:36:27.234Z. Cases from fallback. Extract via extractFallback. 5 pass / 0 fail.




When a switch was heard, SAT, GPA, football, aid-needed, and out-of-state stayed on the file. The spoken line names SAT, GPA, geography, and football, but not aid — aid still stayed on the sheet.

## Journalism list, then sports (journalism-to-sports) — PASS

Marcus is a Pennsylvania junior outside Pittsburgh. Interested in journalism. 3.5 GPA, 1280 SAT. Plays football. Family is fine with a mix of states.

Follow-up: “I think he wants to pursue sports.”

Heard as: revise_criteria. Major changed: true. Old facts kept: true. List moved: true. Message honest: true.
Before focus: Journalism journalism required
After focus: Sports sports required
Kept: {"sat":true,"gpa":true,"football":true}
Assistant: I'll look for schools with a strong sports program, keeping SAT 1280, GPA 3.5, Plays football. Replacing Journalism as the academic focus.

## Same journalism student, switch to med school (switch-to-med-school) — PASS

Marcus is a Pennsylvania junior outside Pittsburgh. Interested in journalism. 3.5 GPA, 1280 SAT. Plays football. Family is fine with a mix of states.

Follow-up: “he wants to switch to med school”

Heard as: revise_criteria. Major changed: true. Old facts kept: true. List moved: true. Message honest: true.
Before focus: Journalism journalism required
After focus: Biology biology required
Kept: {"sat":true,"gpa":true,"football":true}
Assistant: I'll update the list around Biology, keeping SAT 1280, GPA 3.5, Plays football. Replacing Journalism as the academic focus.

## CS, far from home, needs aid → nursing (cs-to-nursing-keep-aid-oos) — PASS

Aisha, Texas. 1320 SAT, 3.7 GPA. Computer science. Wants to go far from home, out of state. Needs financial aid — family cannot cover sticker.

Follow-up: “she wants to switch to nursing”

Heard as: revise_criteria. Major changed: true. Old facts kept: true. List moved: true. Message honest: true.
Before focus: Computer science computer_science required
After focus: Nursing nursing required
Kept: {"sat":true,"gpa":true,"aid":true,"far":true}
Assistant: I'll update the list around Nursing, keeping SAT 1320, GPA 3.7, Out of state — far from home. Replacing Computer science as the academic focus.

## Acting plus football → political science (acting-to-polisci-keep-football) — PASS

Jordan, Ohio. 3.6 GPA, 1210 SAT. Wants acting. Plays football. No distance preference on file.

Follow-up: “he wants to switch to political science”

Heard as: revise_criteria. Major changed: true. Old facts kept: true. List moved: true. Message honest: true.
Before focus: Acting / entertainment performing_arts required
After focus: Political science political_science required
Kept: {"sat":true,"gpa":true,"football":true}
Assistant: I'll update the list around Political science, keeping SAT 1210, GPA 3.6, Plays football. Replacing Acting / entertainment as the academic focus.

## Not sure about law, then actually law (law-hedge-then-lock) — PASS

Priya, Virginia. 1400 SAT, 3.8 GPA. Interested in law but not sure. Family wants her close to home.

Follow-up: “actually law”

Heard as: revise_criteria. Major changed: true. Old facts kept: true. List moved: true. Message honest: true.
Before focus: Law (not sure) law preferred
After focus: Law / pre-law law required
Kept: {"sat":true,"gpa":true,"geo":true}
Assistant: I'll lock in law, keeping SAT 1400, GPA 3.8, Within ~300 miles of home. Replacing Law (not sure) as the academic focus.
