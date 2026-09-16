# Gemini counselor evals

Prototype relies on a rigid, repetitive school template and repeatedly ignores critical student constraints.

Ran 2026-09-16T07:59:35.188Z on gemini-3.6-flash. Cases from gemini. 0 pass / 10 fail.

Prototype risk: The system has a severe 'hardcoded template' bias, frequently recommending the same subset of schools (Temple, West Chester, Millersville, Cornell, CMU, NYU) regardless of the student's major, budget, or emotional needs. It also routinely misclassifies highly selective schools as 'Targets' for low-to-mid-range students, posing a massive liability risk for counselors.

## Conflicting Geography (conflicting-geography)

Liam wants to stay within a 3-hour drive of family in Chicago, but his mother is demanding warm coastal weather year-round in California or Florida. Looking for business or engineering programs. Unweighted GPA 3.7, ACT 29. Needs an urban or suburban setting with strong internship access.

List: 8 schools. Mix L/T/R 4/4/0. Affordable: 0. Catalog: overlay. Invented criteria rows: 0.
Judge: fail. Fit 2/5, extract 2/5, balance 2/5, affordability 3/5, usefulness 1/5.
Worked: Identified Liam's interest in Business and Engineering.
Broke: Completely failed to resolve the geographic conflict. It set his home state to CA (ignoring Chicago), and then recommended schools in NY, PA, NC, GA, and TX, none of which are within a 3-hour drive of Chicago or strictly 'warm coastal' (RIT in Rochester, NY is freezing). It also labeled highly selective schools like UCLA and USC (17% admit rates) as 'Targets' for a 3.7 GPA and 29 ACT.

## High Stats with Critical Need-Based Aid (high-stats-need-aid)

Maya has a 4.0 UW GPA and 1560 SAT with stellar robotics ECs, aiming for engineering. However, family expected contribution is $0 and she cannot take on loans, requiring 100% demonstrated need met or heavy merit guarantees while keeping academic rigor high.

List: 10 schools. Mix L/T/R 3/4/3. Affordable: 7. Catalog: overlay. Invented criteria rows: 0.
Judge: fail. Fit 2/5, extract 3/5, balance 2/5, affordability 1/5, usefulness 1/5.
Worked: Recognized Maya's high academic stats (1560 SAT, 4.0 GPA) and interest in Engineering.
Broke: Completely ignored the $0 EFC and 'no loans' constraint. It marked state schools like Penn State, Rutgers, and Temple as 'Likely Affordable' with net prices of $16k-$23k, which is a financial disaster for a $0 EFC student. It also labeled mid-tier safeties (Temple, West Chester) as 'Likelies' but failed to suggest schools that actually meet 100% of demonstrated need.

## Test-Optional with Missing Scores (missing-test-scores)

Julian has a 3.85 GPA with rigorous AP coursework in AP Bio and AP Env Sci, targeting biology or environmental_science. He has no SAT or ACT scores due to repeated test center cancellations and needs schools where test-optional policies carry zero penalty for institutional aid.

List: 8 schools. Mix L/T/R 5/3/0. Affordable: 5. Catalog: overlay. Invented criteria rows: 0.
Judge: fail. Fit 2/5, extract 3/5, balance 2/5, affordability 3/5, usefulness 2/5.
Worked: Identified the Biology major and Julian's 3.85 GPA.
Broke: Missed his Environmental Science interest. More critically, it labeled hyper-selective schools like Cornell (14% admit), NYU (9% admit), and CMU (10% admit) as 'Targets' for a test-optional student with a 3.85 GPA. This is a dangerous misrepresentation of admissions chances.

## Program Not in Tool Directory (unmapped-major)

Sienna is set on studying Game Development and Sound Architecture with a complete digital portfolio. GPA 3.5, SAT 1280. She is unsure whether to select art, design, or computer_science in system drop-downs to capture her target major.

List: 10 schools. Mix L/T/R 3/4/3. Affordable: 4. Catalog: overlay. Invented criteria rows: 0.
Judge: fail. Fit 2/5, extract 3/5, balance 2/5, affordability 3/5, usefulness 1/5.
Worked: Extracted the basic GPA and SAT scores.
Broke: The tool could not handle 'Game Development and Sound Architecture' and defaulted to generic 'Design' and 'Art'. It then recommended standard liberal arts and state schools (like Millersville and West Chester) that do not have specialized programs in game design or sound architecture. It also labeled highly selective schools like UNC and UIUC as 'Targets' for a 3.5 GPA and 1280 SAT.

## Wide Open and Hedging Majors (hedging-interests)

Ethan is torn between nursing, business, and art. GPA 3.4, ACT 24. Wants a mid-sized university where he can easily switch majors or complete pre-requisites without getting locked out by capped or direct-entry program rules.

List: 10 schools. Mix L/T/R 3/4/3. Affordable: 5. Catalog: overlay. Invented criteria rows: 0.
Judge: fail. Fit 1/5, extract 4/5, balance 1/5, affordability 3/5, usefulness 1/5.
Worked: Successfully extracted the three disparate majors (Art, Nursing, Business).
Broke: The list is a logistical nightmare. It recommends schools like Cornell, NYU, and UNC for a student with a 3.4 GPA and 24 ACT. Furthermore, these schools have incredibly rigid, capped, or direct-entry programs for Business and Nursing, making it virtually impossible for a student to 'easily switch' between them as requested.

## Extremely Sparse Notes (extremely-sparse)

Chloe. GPA around 3.2. Wants agriculture or marine_biology. East Coast preferred. Budget around $35k total per year.

List: 10 schools. Mix L/T/R 3/4/3. Affordable: 5. Catalog: overlay. Invented criteria rows: 0.
Judge: fail. Fit 2/5, extract 3/5, balance 2/5, affordability 3/5, usefulness 1/5.
Worked: Identified the 3.2 GPA and the Agriculture interest.
Broke: Missed the Marine Biology interest entirely. It recommended schools like Temple, West Chester, Millersville, BU, Lehigh, and Northeastern, which do not even offer Agriculture majors. It also ignored the East Coast preference by including Ohio State and UIUC.

## Overconstrained Criteria (overconstrained-criteria)

Noah insists on direct-entry nursing in downtown Boston for under $15,000 total net price per year, but currently holds a 2.7 GPA and 980 SAT. He refuses community college pathways or non-urban options.

List: 10 schools. Mix L/T/R 3/4/3. Affordable: 5. Catalog: overlay. Invented criteria rows: 0.
Judge: fail. Fit 1/5, extract 3/5, balance 1/5, affordability 2/5, usefulness 1/5.
Worked: Extracted the low GPA (2.7) and SAT (980).
Broke: Completely failed on every constraint. It recommended zero schools in Boston. It recommended Cornell, CMU, and Lehigh—none of which offer Nursing, and all of which are academically impossible for a 2.7 GPA. It also failed to address the under-$15k budget constraint.

## Homeschool Without Standard GPA (homeschool-missing-gpa)

Freya has been homeschooled through high school without official letter grades or a GPA, but submitted a project narrative and a 1420 SAT. She wants computer_science or law pathways at institutions comfortable evaluating narrative transcript portfolios.

List: 10 schools. Mix L/T/R 3/4/3. Affordable: 4. Catalog: overlay. Invented criteria rows: 0.
Judge: fail. Fit 2/5, extract 3/5, balance 2/5, affordability 3/5, usefulness 1/5.
Worked: Extracted the 1420 SAT score.
Broke: Missed the Computer Science major. It recommended massive, rigid public universities (UIUC, Penn State) and highly selective private universities (Cornell, CMU, NYU) that are notoriously difficult for homeschoolers without official GPAs to access, completely ignoring the request for institutions comfortable with narrative portfolios.

## High Stats and Extremely Risk-Averse (high-stats-risk-averse)

Caleb holds a 3.98 UW GPA and 1540 SAT in heavy STEM coursework. Interested in engineering. He feels intense anxiety around rejection and refuses to apply to hyper-selective schools, wanting a list dominated by highly predictable options with top honors colleges and auto-merit.

List: 10 schools. Mix L/T/R 3/4/3. Affordable: 3. Catalog: overlay. Invented criteria rows: 0.
Judge: fail. Fit 1/5, extract 3/5, balance 2/5, affordability 3/5, usefulness 1/5.
Worked: Extracted the high academic profile (3.98 GPA, 1540 SAT).
Broke: Completely ignored the student's intense rejection anxiety and explicit refusal to apply to hyper-selective schools. The tool recommended Cornell, Carnegie Mellon, Lehigh, and Boston University—all highly selective schools that would trigger the student's anxiety. It failed to find predictable options with strong honors colleges and auto-merit.

## Parental Brand Pressure vs. Low Stats (parental-brand-mismatch)

Zara's parents demand she only apply to nationally recognizable, household-name universities for business or law. However, Zara has an unweighted GPA of 2.9, SAT of 1050, and minimal extracurricular involvement.

List: 10 schools. Mix L/T/R 3/4/3. Affordable: 5. Catalog: overlay. Invented criteria rows: 0.
Judge: fail. Fit 2/5, extract 3/5, balance 1/5, affordability 3/5, usefulness 1/5.
Worked: Extracted the 2.9 GPA and 1050 SAT.
Broke: The list is a dangerous mix of non-brand safeties (West Chester, Millersville) that won't satisfy the parents, and impossible reaches (UMich, CMU, Northeastern) that are completely out of reach for a 2.9 GPA / 1050 SAT. It labeled competitive public schools like Ohio State and Pitt as 'Targets', which is highly unrealistic.
