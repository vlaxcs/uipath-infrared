import type { Language } from "../content";

export type Todo = { todo: string };
export type Slot = string | Todo;

export function todo(text: string): Todo {
  return { todo: text };
}

export function isTodo(slot: Slot): slot is Todo {
  return typeof slot !== "string";
}

type Figure = { value: string; label: string; source: string };
type Step = { title: string; text: string };
type Rival = { name: string; does: string; lacks: string };
type Member = { name: string; role: string };
type Law = { short: string; summary: string; name: string; says: string; source: string };
type Calc = { name: string; value: string; how: string };

export type PitchCopy = {
  title: string;
  todoLabel: string;
  skipLink: string;
  languageLabel: string;
  byDigi: string;
  sourceLabel: string;
  hero: { event: string; tagline: Slot; lead: string; noInstall: string };
  duty: { label: string; title: string; laws: Law[] };
  problem: {
    label: string;
    title: string;
    figures: Figure[];
    voicesLabel: string;
    voicesStats: string;
    voices: string[];
    voicesSource: string;
  };
  solution: {
    label: string;
    title: string;
    points: string[];
    chatNote: string;
    providerLabel: string;
    provider: string[];
    herLabel: string;
    her: string[];
  };
  how: { label: string; title: string; steps: Step[] };
  product: { label: string; title: string; screens: { name: string; shot: Todo }[] };
  competition: { label: string; title: string; does: string; lacks: string; rivals: Rival[]; edgeLabel: string; edge: string; check: Todo };
  market: {
    label: string;
    title: string;
    marketLabel: string;
    market: Figure[];
    contractLabel: string;
    contractLead: string;
    contract: string[];
    moneyLabel: string;
    moneyNote: string;
    money: Calc[];
    rolloutLabel: string;
    rollout: Step[];
  };
  numbers: { label: string; title: string; measuredLabel: string; measured: { value: string; label: string }[]; targetsLabel: string; targets: { label: string; value: Slot }[] };
  whyNow: { label: string; title: string; candidatesLabel: string; candidates: { text: string; source: string }[]; pick: Todo; edgeLabel: string; edgePoints: string[] };
  team: { label: string; name: Slot; members: Member[] };
  closing: { title: string; back: string; disclaimer: string };
};

const SOURCES = {
  digitalSkills: "Eurostat via Romania Insider, 2025",
  defaultPassword: "Bitdefender / Broadband Genie (UK)",
  routerAttacks: "Zscaler via ADMIN Magazine",
  support: "CORDIS / TEApot",
  cra: "Jones Day, European Commission",
  orange: "Orange.ro, Economica.net",
  law506: "Law 506/2004, art. 3, as amended by OUG 13/2012 (legislatie.just.ro)",
  nis2: "Directive (EU) 2022/2555, art. 2(2)(a), art. 21, art. 34, Annex I sector 8 (EUR-Lex)",
  nis2ro: "OUG 155/2024, approved by Law 124/2025 (CMS, Clifford Chance)",
  ancom: "ANCOM, fixed internet at the end of 2025",
  ancomDigi: "ANCOM via Ziarul Financiar, 2025",
};

const SURSE = {
  ...SOURCES,
  law506: "Legea 506/2004, art. 3, modificată prin OUG 13/2012 (legislatie.just.ro)",
  nis2: "Directiva (UE) 2022/2555, art. 2 alin. (2) lit. a), art. 21, art. 34, Anexa I sectorul 8 (EUR-Lex)",
  nis2ro: "OUG 155/2024, aprobată prin Legea 124/2025 (CMS, Clifford Chance)",
  ancom: "ANCOM, internet fix la finalul lui 2025",
  ancomDigi: "ANCOM prin Ziarul Financiar, 2025",
};

const en: PitchCopy = {
  title: "Netpotu | Pitch",
  todoLabel: "TODO",
  skipLink: "Skip to content",
  languageLabel: "Language",
  byDigi: "by Digi",
  sourceLabel: "Source",
  hero: {
    event: "R Systems Hackathon 2026 · Secure Networks, Simply Explained",
    tagline: todo("one sentence, Vlad"),
    lead: "It checks the home network and tells her what to fix first, one step at a time.",
    noInstall: "Nothing to install. It comes on WhatsApp, on the number in her contract.",
  },
  duty: {
    label: "Why providers need it",
    title: "The law already makes providers responsible for subscribers' security.",
    laws: [
      {
        short: "Law 506/2004",
        summary: "Secure the service, inform subscribers.",
        name: "ePrivacy in Romania: Law 506/2004, art. 3",
        says: "Security proportionate to the risk (para. 2). If a breach puts personal data at risk, tell subscribers the risk and the remedies (para. 5).",
        source: SOURCES.law506,
      },
      {
        short: "NIS2",
        summary: "Telecom providers in scope, any size.",
        name: "NIS2: Directive (EU) 2022/2555",
        says: "Every telecom provider, any size: manage cyber risk. Fines up to at least 10 M€ or 2% of turnover.",
        source: SOURCES.nis2,
      },
      {
        short: "OUG 155/2024",
        summary: "NIS2 in Romanian law.",
        name: "NIS2 in Romania",
        says: "OUG 155/2024, approved by Law 124/2025: register with DNSC, management is accountable.",
        source: SOURCES.nis2ro,
      },
    ],
  },
  problem: {
    label: "The problem",
    title: "Everyone has internet. Almost nobody knows how to secure it.",
    figures: [
      { value: "31.8%", label: "of Romanians have basic digital skills, last in the EU.", source: SOURCES.digitalSkills },
      { value: "81%", label: "kept the router's default password.", source: SOURCES.defaultPassword },
      { value: ">75%", label: "of IoT attacks hit routers.", source: SOURCES.routerAttacks },
    ],
    voicesLabel: "What older people told us",
    voicesStats: "Retirees' Facebook group: 47 reactions, 6 comments.",
    voices: [
      "\"On WhatsApp I could read at my own pace.\"",
      "\"It has to come from the real company, there are many crooks on WhatsApp. We check the number first.\"",
    ],
    voicesSource: "Facebook, November 2026, translated, no names.",
  },
  solution: {
    label: "The solution",
    title: "We don't show what could attack her. We show what she has to do.",
    points: [
      "On WhatsApp. Nothing to install.",
      "One step at a time, worst risk first.",
      "The router checks every step.",
    ],
    chatNote: "The demo chat, in Romanian.",
    providerLabel: "For the provider",
    provider: [
      "Fewer support calls and visits.",
      "The duty to inform, met with a record.",
      "Support sees her exact steps.",
    ],
    herLabel: "For her",
    her: [
      "Nothing to install.",
      "Plain words, one step at a time.",
      "No more calling the grandson.",
    ],
  },
  how: {
    label: "How it works",
    title: "From the scan to a fixed home, one step at a time.",
    steps: [
      { title: "The router scans", text: "In the router she already has." },
      { title: "The engine orders the fixes", text: "Our rules, same result every run. No AI." },
      { title: "She gets one step", text: "Worst device first, on WhatsApp." },
      { title: "The router checks again", text: "Fixed: next. Not yet: simpler words." },
    ],
  },
  product: {
    label: "The product",
    title: "Her chat, her steps, and the operator's view of both.",
    screens: [
      { name: "WhatsApp chat", shot: todo("screenshot of /wa") },
      { name: "Her steps", shot: todo("screenshot of the guided tour, /app") },
      { name: "Operator panel", shot: todo("screenshot of /operator/roadmap") },
    ],
  },
  competition: {
    label: "Competition",
    title: "Everyone blocks attacks from outside. Nobody tells her what to fix.",
    does: "What it does",
    lacks: "What it lacks",
    rivals: [
      { name: "Orange Cybersecure", does: "Protection, 4 €/month.", lacks: "No fix steps for her devices." },
      { name: "F-Secure Connected Home", does: "Router SDK, 200+ operators.", lacks: "Protection, not \"fix this first\"." },
      { name: "Bitdefender Router Protection", does: "Router agent for ISPs.", lacks: "Protection, not repair steps." },
      { name: "Plume HomePass Guard", does: "Auto-quarantine.", lacks: "Explains nothing." },
      { name: "Fing", does: "Scanner app.", lacks: "Too technical." },
    ],
    edgeLabel: "Our difference",
    edge: "What to fix, in order, in plain words, checked.",
    check: todo("read Orange's terms before the pitch, PRD 4"),
  },
  market: {
    label: "Business plan",
    title: "Providers buy it as a clause in the subscription contract.",
    marketLabel: "The market: internet providers",
    market: [
      { value: "7.02 M", label: "fixed internet connections in Romania.", source: SOURCES.ancom },
      { value: "~74%", label: "are Digi's.", source: SOURCES.ancomDigi },
      { value: "~50%", label: "of support calls are about Wi-Fi.", source: SOURCES.support },
    ],
    contractLabel: "The contractual service",
    contractLead: "One clause, accepted at signing or renewal:",
    contract: [
      "The router checks only her home network.",
      "Steps on WhatsApp, on the contract number.",
      "Provider fixes wait for her \"Yes\".",
      "No addresses or device names leave home.",
      "She can stop it any time.",
    ],
    moneyLabel: "The money, one scenario",
    moneyNote: "Our assumptions: 0.50 € per home per month, 10% of Digi's fixed base.",
    money: [
      { name: "Homes covered", value: "≈ 519,000", how: "7.02 M × 74% × 10%" },
      { name: "Licence paid by the provider", value: "≈ 3.1 M€ / year", how: "519,000 × 0.50 € × 12" },
      { name: "Support cost avoided", value: "≈ 9.5 to 13.5 M€ / year", how: "1 call/home/year × 26 min × 0.7 to 1 €" },
      { name: "For her", value: "Included in the subscription", how: "retention, not upsell" },
    ],
    rolloutLabel: "Rollout",
    rollout: [
      { title: "Pilot", text: "One county, 3 months, count the calls." },
      { title: "New contracts", text: "Clause in every new contract." },
      { title: "Existing customers", text: "Offered at renewal." },
    ],
  },
  numbers: {
    label: "Numbers",
    title: "Measured on the official files and on our own lab.",
    measuredLabel: "Measured",
    measured: [
      { value: "24/24", label: "Validation Set rows, 0 extra" },
      { value: "8/8", label: "scores, identical every run" },
      { value: "45/45", label: "rows on 27 trap files" },
      { value: "40 → 80", label: "lab score, before → after" },
      { value: "92 s", label: "full lab scan (35 s quick)" },
      { value: "~10 s", label: "to recheck a step" },
    ],
    targetsLabel: "Still to measure",
    targets: [
      { label: "Time to \"most dangerous + first step\"", value: todo("under 30 s, test with a non-technical person") },
      { label: "Explanations understood by a non-technical person", value: todo("X out of Y") },
    ],
  },
  whyNow: {
    label: "Why us, why now",
    title: "Providers sell home security. The law is catching up.",
    candidatesLabel: "Why now",
    candidates: [
      {
        text: "Cyber Resilience Act: since 11 Sept 2026, routers' flaws must be reported.",
        source: SOURCES.cra,
      },
      { text: "Orange already sells home security, 4 €/month.", source: SOURCES.orange },
    ],
    pick: todo("which argument goes into the pitch, PRD 2.1"),
    edgeLabel: "Why us",
    edgePoints: [
      "Fix steps, not attack lists.",
      "AI never decides a finding.",
      "Nothing to install.",
    ],
  },
  team: {
    label: "The team",
    name: todo("team name"),
    members: [
      { name: "Ecaterina", role: "Engine lead" },
      { name: "Andrei", role: "Engine, fixing graph order" },
      { name: "Dalvladut", role: "Lab, guardrail, live scan" },
      { name: "Vlad", role: "UI, brand, RO/EN texts, AI safety" },
    ],
  },
  closing: {
    title: "Netpotu tells her what to fix first, and checks that it worked.",
    back: "See the product page",
    disclaimer: "Hackathon project. Digi is an example, not involved. Not legal advice.",
  },
};

const ro: PitchCopy = {
  title: "Netpotu | Pitch",
  todoLabel: "COMPLETEAZĂ",
  skipLink: "Sari la conținut",
  languageLabel: "Limba",
  byDigi: "de la Digi",
  sourceLabel: "Sursa",
  hero: {
    event: "R Systems Hackathon 2026 · Secure Networks, Simply Explained",
    tagline: todo("o propoziție, Vlad"),
    lead: "Verifică rețeaua de acasă și îi spune ce să repare întâi, pas cu pas.",
    noInstall: "Nimic de instalat. Vine pe WhatsApp, pe numărul din contract.",
  },
  duty: {
    label: "De ce le trebuie furnizorilor",
    title: "Legea îi face deja pe furnizori responsabili de securitatea abonaților.",
    laws: [
      {
        short: "Legea 506/2004",
        summary: "Serviciu sigur, abonați informați.",
        name: "ePrivacy în România: Legea 506/2004, art. 3",
        says: "Securitate pe măsura riscului (alin. 2). Dacă o încălcare pune datele în pericol, abonații află riscul și remediile (alin. 5).",
        source: SURSE.law506,
      },
      {
        short: "NIS2",
        summary: "Furnizorii telecom, orice mărime.",
        name: "NIS2: Directiva (UE) 2022/2555",
        says: "Orice furnizor telecom, de orice mărime: gestionează riscul cibernetic. Amenzi de cel puțin 10 M€ sau 2% din cifra de afaceri.",
        source: SURSE.nis2,
      },
      {
        short: "OUG 155/2024",
        summary: "NIS2 în legea românească.",
        name: "NIS2 în România",
        says: "OUG 155/2024, aprobată prin Legea 124/2025: înregistrare la DNSC, conducerea răspunde.",
        source: SURSE.nis2ro,
      },
    ],
  },
  problem: {
    label: "Problema",
    title: "Toți au internet. Aproape nimeni nu știe să-l securizeze.",
    figures: [
      { value: "31,8%", label: "dintre români au competențe digitale de bază, ultimii în UE.", source: SOURCES.digitalSkills },
      { value: "81%", label: "au păstrat parola implicită a routerului.", source: SOURCES.defaultPassword },
      { value: ">75%", label: "dintre atacurile smart lovesc routerul.", source: SOURCES.routerAttacks },
    ],
    voicesLabel: "Ce ne-au spus cei mai în vârstă",
    voicesStats: "Grup de Facebook al pensionarilor: 47 de reacții, 6 comentarii.",
    voices: [
      "„Pe WhatsApp aș putea citi în ritmul meu.”",
      "„Să fie de la firma adevărată, că sunt mulți șmecheri pe WhatsApp. Să verificăm întâi numărul.”",
    ],
    voicesSource: "Facebook, noiembrie 2026, fără nume.",
  },
  solution: {
    label: "Soluția",
    title: "Nu arătăm ce o poate ataca. Arătăm ce are de făcut.",
    points: [
      "Pe WhatsApp. Nimic de instalat.",
      "Câte un pas, întâi riscul cel mai mare.",
      "Routerul verifică fiecare pas.",
    ],
    chatNote: "Conversația din demo.",
    providerLabel: "Pentru furnizor",
    provider: [
      "Mai puține apeluri și deplasări.",
      "Obligația de informare, cu evidență.",
      "Suportul îi vede exact pașii.",
    ],
    herLabel: "Pentru ea",
    her: [
      "Nimic de instalat.",
      "Cuvinte simple, câte un pas.",
      "Nu-și mai sună nepotul.",
    ],
  },
  how: {
    label: "Cum funcționează",
    title: "De la verificare la o casă reparată, câte un pas.",
    steps: [
      { title: "Routerul verifică", text: "În routerul pe care îl are deja." },
      { title: "Motorul ordonează reparațiile", text: "Regulile noastre, același rezultat. Fără AI." },
      { title: "Ea primește un pas", text: "Întâi aparatul cel mai periculos, pe WhatsApp." },
      { title: "Routerul verifică din nou", text: "Rezolvat: urmează. Nu: mai simplu." },
    ],
  },
  product: {
    label: "Produsul",
    title: "Conversația ei, pașii ei și ce vede operatorul.",
    screens: [
      { name: "Conversația pe WhatsApp", shot: todo("captură din /wa") },
      { name: "Pașii ei", shot: todo("captură din turul ghidat, /app") },
      { name: "Panoul operatorului", shot: todo("captură din /operator/roadmap") },
    ],
  },
  competition: {
    label: "Concurența",
    title: "Toți blochează atacurile din afară. Nimeni nu-i spune ce să repare.",
    does: "Ce face",
    lacks: "Ce îi lipsește",
    rivals: [
      { name: "Orange Cybersecure", does: "Protecție, 4 €/lună.", lacks: "Fără pași de reparat." },
      { name: "F-Secure Connected Home", does: "SDK în router, 200+ operatori.", lacks: "Protecție, nu „repară asta întâi”." },
      { name: "Bitdefender Router Protection", does: "Agent în router.", lacks: "Protecție, nu pași de reparat." },
      { name: "Plume HomePass Guard", does: "Carantină automată.", lacks: "Nu explică nimic." },
      { name: "Fing", does: "Aplicație de scanare.", lacks: "Prea tehnică." },
    ],
    edgeLabel: "Diferența noastră",
    edge: "Ce să repare, în ordine, simplu, verificat.",
    check: todo("citim termenii Orange înainte de pitch, PRD 4"),
  },
  market: {
    label: "Planul de afaceri",
    title: "Furnizorii îl cumpără ca o clauză în contractul de abonament.",
    marketLabel: "Piața: furnizorii de internet",
    market: [
      { value: "7,02 mil.", label: "conexiuni de internet fix în România.", source: SURSE.ancom },
      { value: "~74%", label: "sunt ale Digi.", source: SURSE.ancomDigi },
      { value: "~50%", label: "dintre apelurile la suport sunt despre Wi-Fi.", source: SOURCES.support },
    ],
    contractLabel: "Serviciul contractual",
    contractLead: "O clauză, acceptată la semnare sau reînnoire:",
    contract: [
      "Routerul verifică doar rețeaua ei.",
      "Pașii vin pe WhatsApp, pe numărul din contract.",
      "Reparațiile furnizorului așteaptă „Da”-ul ei.",
      "Nicio adresă sau nume de aparat nu iese din casă.",
      "Poate opri oricând.",
    ],
    moneyLabel: "Banii, un scenariu",
    moneyNote: "Ipotezele noastre: 0,50 € pe casă pe lună, 10% din abonații Digi.",
    money: [
      { name: "Case acoperite", value: "≈ 519.000", how: "7,02 mil. × 74% × 10%" },
      { name: "Licența plătită de furnizor", value: "≈ 3,1 M€ / an", how: "519.000 × 0,50 € × 12" },
      { name: "Cost de suport evitat", value: "≈ 9,5 până la 13,5 M€ / an", how: "1 apel/casă/an × 26 min × 0,7 până la 1 €" },
      { name: "Pentru ea", value: "Inclus în abonament", how: "păstrarea clienților, nu vânzare în plus" },
    ],
    rolloutLabel: "Extinderea",
    rollout: [
      { title: "Pilot", text: "Un județ, 3 luni, numărăm apelurile." },
      { title: "Contracte noi", text: "Clauza în fiecare contract nou." },
      { title: "Clienții existenți", text: "Oferit la reînnoire." },
    ],
  },
  numbers: {
    label: "Cifre",
    title: "Măsurate pe fișierele oficiale și pe laboratorul nostru.",
    measuredLabel: "Măsurat",
    measured: [
      { value: "24/24", label: "rânduri de validare, 0 în plus" },
      { value: "8/8", label: "scoruri, identice la fiecare rulare" },
      { value: "45/45", label: "rânduri pe 27 de fișiere-capcană" },
      { value: "40 → 80", label: "scorul laboratorului, înainte → după" },
      { value: "92 s", label: "verificare completă (35 s rapidă)" },
      { value: "~10 s", label: "ca să reverifice un pas" },
    ],
    targetsLabel: "De măsurat",
    targets: [
      { label: "Timp până la „cel mai periculos + primul pas”", value: todo("sub 30 s, test cu un om fără cunoștințe tehnice") },
      { label: "Explicații înțelese de un om fără cunoștințe tehnice", value: todo("X din Y") },
    ],
  },
  whyNow: {
    label: "De ce noi, de ce acum",
    title: "Furnizorii vând securitate. Legea ajunge din urmă.",
    candidatesLabel: "De ce acum",
    candidates: [
      {
        text: "Cyber Resilience Act: din 11 sept. 2026, defectele routerelor se raportează.",
        source: SOURCES.cra,
      },
      { text: "Orange vinde deja securitate, 4 €/lună.", source: SOURCES.orange },
    ],
    pick: todo("ce argument intră în pitch, PRD 2.1"),
    edgeLabel: "De ce noi",
    edgePoints: [
      "Pași de reparat, nu liste de atacuri.",
      "AI-ul nu decide nicio problemă.",
      "Nimic de instalat.",
    ],
  },
  team: {
    label: "Echipa",
    name: todo("numele echipei"),
    members: [
      { name: "Ecaterina", role: "Șefa motorului" },
      { name: "Andrei", role: "Motor, ordinea pașilor" },
      { name: "Dalvladut", role: "Laborator, protecție, scanare live" },
      { name: "Vlad", role: "Interfață, brand, texte RO/EN, siguranța AI" },
    ],
  },
  closing: {
    title: "Netpotu îi spune ce să repare întâi și verifică dacă a mers.",
    back: "Vezi pagina produsului",
    disclaimer: "Proiect de hackathon. Digi e un exemplu, nu e implicat. Nu e consultanță juridică.",
  },
};

export const pitchCopy: Record<Language, PitchCopy> = { en, ro };
