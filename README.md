# Infrared

Un workflow agentic care replanifică infrastructura cloud a unei companii în jurul proiectelor din roadmap-ul ei financiar: găsește ce se poate optimiza, propune planuri, le verifică cu un motor determinist, le repetă într-un sandbox și îi lasă pe oameni să decidă, din dashboard sau din Slack.

Repo: https://github.com/vlaxcs/uipath-infrared · Descriere: [docs/descriere.md](docs/descriere.md) · Specificație: [docs/spec.md](docs/spec.md)

![Prototipul: pagina unui run, cu pipeline-ul și decizia care așteaptă](docs/img/prototip.png)

## Pornire

```bash
make demo
```

Pornește Floci (emulatorul AWS), orchestratorul (:8080), dashboard-ul (http://127.0.0.1:5173/app/) și botul de Slack; Ctrl-C le oprește. Prima dată: completează `.env` (creat din `.env.example`) cu `ANTHROPIC_API_KEY` și tokenurile `SLACK_*`, apoi `make estate` construiește compania demo în Floci. `make help` arată restul.

## Workflow-ul agentic

```mermaid
flowchart TD
    start([Analiză nouă: compania + proiectele din roadmap]) --> extract
    extract["Extract<br/>extractorul citește cloud-ul și leagă resursele de proiecte (tag-uri, apoi nume)"] --> contract{infra.json respectă contractul?}
    contract -- nu --> stop([Run oprit, cu motivul])
    contract -- da --> investigate
    investigate["Investigate<br/>agentul Claude + 3 specialiști (compute, date, rețea) găsesc problemele, cu dovezi"] --> propose
    propose["Propose<br/>agentul propune planuri candidat, ținând cont de focusul și intenția fiecărui proiect"] --> evaluate
    evaluate["Evaluate<br/>motorul determinist calculează costul, disponibilitatea și riscul, verifică constrângerile și ordonează"] --> feasible{toate planurile agentului trec constrângerile?}
    feasible -- "nu (max 2 revizii)" --> propose
    feasible -- da --> present
    present["Present<br/>candidații ordonați, cu schimbările pas cu pas"] --> layout{{"Decizie umană: alege layout-ul<br/>dashboard sau Slack"}}
    layout --> rehearse
    rehearse["Rehearse<br/>sandbox-ul construiește layout-ul în Floci, oprește o componentă și măsoară ce rămâne în picioare"] --> holds{disponibilitatea atinge forecast-ul?}
    holds -- "nu (revizie)" --> propose
    holds -- da --> plan{{"Decizie umană: aprobă planul"}}
    plan --> done([Plan aprobat])
    done -.-> phase2["Faza 2: câte un PR per pas, aplicat de CI-ul clientului"]
```

Regula de bază: **LLM-ul propune, motorul decide, LLM-ul explică.** Fiecare cifră vine din motor, nu din model.
