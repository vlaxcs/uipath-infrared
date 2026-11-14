# Infrared, pe scurt

## Scop

Infrared îi spune unei companii cum să-și mute și să-și reorganizeze infrastructura cloud ca să susțină proiectele pe care le are în plan, cu cost, disponibilitate și risc calculate, și cu pașii concreți de migrare. Un om rămâne mereu cel care decide.

## Problema rezolvată

Infrastructura crește odată cu produsele, dar rar e replanificată: rămân resurse uitate, instanțe supradimensionate, date în regiuni greșite și arhitecturi care nu vor ține la creșterea estimată de finance. A le găsi și a decide ce să schimbi cere zile de muncă de la oameni care știu și cloud-ul, și planurile de business. Instrumentele existente arată costuri sau dau recomandări generice; niciunul nu pornește de la roadmap-ul financiar al fiecărui proiect și nu verifică un plan înainte să-l propună.

## Cum funcționează

1. **Analiza pornește de la companie.** Proiectele vin din roadmap-ul financiar; pentru fiecare, omul alege focusul (cel implicit sau unul propriu: cost, disponibilitate, performanță, zone) și poate scrie în cuvinte ce vrea să facă cu el.
2. **Extract.** Extractorul citește cloud-ul (aici Floci, un emulator AWS) și atribuie resursele proiectelor după tag-uri, apoi după nume.
3. **Investigate.** Un agent Claude, cu trei specialiști (compute, date, rețea), citește infrastructura doar prin unelte read-only și notează fiecare problemă, cu dovezi.
4. **Propose.** Agentul transformă problemele în planuri candidat, ținând cont de focusul și intenția fiecărui proiect și de constrângerile dure (buget, rezidența datelor, disponibilitate minimă).
5. **Evaluate.** Un motor determinist calculează pentru fiecare plan costul, disponibilitatea și riscul, verifică constrângerile și le ordonează. Dacă planurile agentului nu trec, workflow-ul se întoarce la Propose (cel mult de două ori).
6. **Decizia umană.** CTO-ul alege layout-ul din dashboard sau din Slack, ca într-un chat.
7. **Rehearse.** Un sandbox construiește layout-ul ales în Floci, trimite trafic, oprește o componentă și măsoară disponibilitatea. Dacă nu atinge forecast-ul, workflow-ul replanifică.
8. **Aprobare.** Planul repetat cu succes așteaptă aprobarea finală. (Faza 2: câte un pull request per pas, aplicat de CI-ul clientului.)

Tot run-ul se vede live în dashboard (pipeline-ul, fiecare pas cu ce s-a întâmplat și log-ul lui) și în Slack, unde botul postează cardurile de decizie.

## Tehnologii

| Componentă | Tehnologie |
| --- | --- |
| Orchestrator (workflow, stare, API HTTP) | Go |
| Agent (investigate, propose) | Python, Claude Agent SDK, modelul Claude Sonnet |
| Motor de decizie | Python, determinist |
| Extractor | Python, boto3 |
| Sandbox (repetiția) | Python, Docker prin Floci |
| Cloud simulat | Floci (emulator AWS) |
| Dashboard | TypeScript, React, Vite, Tailwind, Rive (mascota) |
| Bot Slack | TypeScript, Slack Bolt (Socket Mode) |
| Contracte între componente | JSON Schema |
| Sign-in și profil | Postgres, GitHub App |

Detalii tehnice: [spec.md](spec.md), [orchestrator.md](orchestrator.md), [estate-projects.md](estate-projects.md).
