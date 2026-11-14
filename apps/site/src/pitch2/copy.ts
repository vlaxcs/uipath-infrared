import type { Language } from "../content";

type Point = { who: string; text: string };
type Section = { id: string; label: string; title: string; tagline?: string; points: Point[] };

export type Pitch2Copy = {
  title: string;
  skipLink: string;
  languageLabel: string;
  byDigi: string;
  tagline: string;
  heroLead: string;
  cta: string;
  sceneLabel: string;
  sections: [Section, Section, Section];
  closing: string;
};

export const pitch2Copy: Record<Language, Pitch2Copy> = {
  en: {
    title: "Infrared | Pitch",
    skipLink: "Skip to content",
    languageLabel: "Language",
    byDigi: "The decision layer for cloud infrastructure.",
    tagline: "Infrastructure decisions, with RECEIPTS.",
    heroLead: "Reads the estate. Prices the move. Proves the plan. You sign it.",
    cta: "Run an analysis",
    sceneLabel: "Two infrastructure islands: racks, links, and small containers travelling between them.",
    closing: "See the change before you make it.",
    sections: [
      {
        id: "problema",
        label: "The problem",
        title: "High infrastructure costs. Constrained budgets. Compromised performance.",
        tagline: "The plan to meet all three is unproven.",
        points: [
          { who: "Costs", text: "Infrastructure costs keep rising. Much of the bill is waste." },
          { who: "Budget", text: "The budget is constrained. There is no new money for a rebuild." },
          { who: "Performance", text: "Performance and reliability pay for the cuts." },
        ],
      },
      {
        id: "solutia",
        label: "How we solve it",
        title: "PRICE it. PROVE it. SIGN it.",
        tagline: "One run. The engine prices the move. The sandbox proves the plan. The CTO signs the decision.",
        points: [
          { who: "Price", text: "Catalog prices, the on-prem lab, egress, migration, outage, and payback." },
          { who: "Prove", text: "Traffic and failure injection in the sandbox; measured availability and latency." },
          { who: "Sign", text: "Two gates, an audit trail, and a decision record the CTO can sign." },
        ],
      },
      {
        id: "de-ce-noi",
        label: "Why us",
        title: "Cost tools REPORT. Migration tools MOVE. Infrared ADVISES.",
        tagline: "Everyone can generate a plan. We can prove one.",
        points: [
          { who: "Cost tools", text: "They show the bill. We show what to change, what it saves, and what could break." },
          { who: "Migration tools", text: "They push a destination. We re-plan the whole estate, across providers and on-prem." },
          { who: "Infrared", text: "The model proposes. The engine decides. The sandbox proves. The CTO signs." },
        ],
      },
    ],
  },
  ro: {
    title: "Infrared | Pitch",
    skipLink: "Sari la conținut",
    languageLabel: "Limba",
    byDigi: "Nivelul de decizie pentru infrastructura cloud.",
    tagline: "Decizii de infrastructură, cu DOVEZI.",
    heroLead: "Citește infrastructura. Prețuiește mutarea. Demonstrează planul. Tu semnezi.",
    cta: "Rulează o analiză",
    sceneLabel: "Două insule de infrastructură: rafturi, legături și mici containere care călătoresc între ele.",
    closing: "Vezi schimbarea înainte să o faci.",
    sections: [
      {
        id: "problema",
        label: "Problema",
        title: "Costuri mari de infrastructură. Bugete limitate. Performanță compromisă.",
        tagline: "Planul care le rezolvă pe toate trei nu e dovedit.",
        points: [
          { who: "Costuri", text: "Costurile de infrastructură cresc. O mare parte din factură e risipă." },
          { who: "Buget", text: "Bugetul e limitat. Nu există bani noi pentru o reconstrucție." },
          { who: "Performanță", text: "Performanța și fiabilitatea plătesc pentru reducerile de cost." },
        ],
      },
      {
        id: "solutia",
        label: "Cum o rezolvăm",
        title: "PREȚUIEȘTE. DEMONSTREAZĂ. SEMNEAZĂ.",
        tagline: "Un run. Motorul prețuiește mutarea. Sandbox-ul demonstrează planul. CTO-ul semnează decizia.",
        points: [
          { who: "Prețuiește", text: "Prețuri din catalog, laboratorul on-prem, egress, migrare, cădere și payback." },
          { who: "Demonstrează", text: "Trafic și căderi injectate în sandbox; disponibilitate și latență măsurate." },
          { who: "Semnează", text: "Două porți de aprobare, o urmă de audit și o decizie pe care CTO-ul o poate semna." },
        ],
      },
      {
        id: "de-ce-noi",
        label: "De ce noi",
        title: "Uneltele de cost RAPORTEAZĂ. Uneltele de migrare MUTĂ. Infrared RECOMANDĂ.",
        tagline: "Oricine poate genera un plan. Noi îl putem demonstra.",
        points: [
          { who: "Unelte de cost", text: "Arată factura. Noi arătăm ce să schimbi, cât economisești și ce se poate rupe." },
          { who: "Unelte de migrare", text: "Împing o destinație. Noi replanificăm toată infrastructura, între provideri și on-prem." },
          { who: "Infrared", text: "Modelul propune. Motorul decide. Sandbox-ul demonstrează. CTO-ul semnează." },
        ],
      },
    ],
  },
};
