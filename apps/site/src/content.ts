export type Language = "ro" | "en";

export type Criterion = "cost" | "availability" | "database";
export type Finding = { name: string; detail: string; criterion: Criterion };
export type Plan = { name: string; price: string; unit: string; detail: string };

export type Content = {
  skipLink: string;
  languageLabel: string;
  tagline: string;
  nav: { cta: string; progress: string; sections: string[] };
  hero: {
    title: string;
    lead: string;
    primary: string;
    secondary: string;
    scene: { label: string };
  };
  run: { title: string; body: string; label: string; copy: string; copied: string };
  finds: {
    title: string;
    criteria: Record<Criterion, string>;
    items: Finding[];
    waste: { value: string; label: string; source: string };
  };
  cluster: { title: string; lead: string; plan: string; reset: string; infrared: string };
  how: { title: string; steps: { title: string; body: string }[]; promise: string };
  pricing: { title: string; plans: Plan[]; consultant: string; billingNote: string };
  faq: { title: string; items: { q: string; a: string }[] };
  footer: {
    title: string;
    back: string;
    tokensLink: string;
    productLink: string;
    product: string;
    resources: string;
    prompt: string;
    promptNote: string;
    copy: string;
    copied: string;
  };
  tokens: {
    title: string;
    lead: string;
    colors: string;
    pairs: string;
    pass: string;
    fail: string;
    copy: string;
    copied: string;
    reset: string;
  };
};

const ro: Content = {
  skipLink: "Sari la conținut",
  languageLabel: "Limba",
  tagline: "infrastructură per proiect",
  nav: { cta: "Rulează o analiză", progress: "Secțiunile paginii", sections: ["Acasă", "Ce găsește", "Un run", "Plan", "Cum funcționează", "Prețuri", "Întrebări", "Final"] },
  hero: {
    title: "Infrastructura, replanificată pentru fiecare proiect.",
    lead: "Citește cloud-ul. Propune mutarea. O testează în sandbox. Îți dă pașii.",
    primary: "Rulează o analiză",
    secondary: "Vezi un run",
    scene: {
      label: "Două insule de infrastructură: rafturi, legături și mici containere care călătoresc între ele.",
    },
  },
  run: {
    title: "Planul, ca diff.",
    body: "Read-only. Fiecare schimbare are un pas de aplicare.",
    label: "sample run, demo project",
    copy: "copiază",
    copied: "copiat",
  },
  finds: {
    title: "Ce găsește.",
    criteria: { cost: "Cost", availability: "Disponibilitate", database: "Baze de date" },
    waste: { value: "29%", label: "din cheltuiala IaaS/PaaS e risipă", source: "Flexera 2026" },
    items: [
      { name: "Resurse idle și orfane", detail: "Instanțe, volume, IP-uri fără trafic.", criterion: "cost" },
      { name: "Rightsizing", detail: "CPU și RAM măsurate.", criterion: "cost" },
      { name: "GPU și tokeni", detail: "Capacitate nefolosită; consum LLM.", criterion: "cost" },
      { name: "Fără fallback", detail: "O zonă sau un nod pică tot.", criterion: "availability" },
      { name: "Tabele calde", detail: "Din pg_stat_statements.", criterion: "database" },
      { name: "Domenii amestecate", detail: "Split, replici, partiții.", criterion: "database" },
    ],
  },
  cluster: {
    title: "Planul, pe clustere.",
    lead: "Fiecare proiect e un cluster. Nodurile sunt resurse; mărimea e costul lunar, culoarea e providerul. Conturul punctat e schimbarea propusă.",
    plan: "Planifică",
    reset: "Resetează",
    infrared: "Vedere infrared",
  },
  how: {
    title: "Cum funcționează.",
    steps: [
      { title: "Citește", body: "Resurse, metrici, scheme. Doar citire." },
      { title: "Decide", body: "Per proiect: cost, disponibilitate, zone." },
      { title: "Testează", body: "Trafic și căderi, în sandbox." },
      { title: "Aplică", body: "Pull request. Tu aprobi, CI-ul aplică." },
    ],
    promise: "Read-only. Nu aplică nimic singur.",
  },
  pricing: {
    title: "Prețuri.",
    plans: [
      { name: "Pachet", price: "490 USD", unit: "5 run-uri", detail: "98 USD per run." },
      { name: "Abonament", price: "199 USD", unit: "pe lună", detail: "Run-uri programate." },
    ],
    consultant: "Un review de consultant pornește de la 495 USD.",
    billingNote: "Facturat per companie.",
  },
  faq: {
    title: "Întrebări.",
    items: [
      { q: "Ce acces cere?", a: "Read-only: AWS describe și list, CloudWatch, Postgres, GitHub." },
      { q: "Cum ajunge schimbarea în producție?", a: "Ca pull request. Tu aprobi, CI-ul aplică." },
      { q: "Unde se poate muta?", a: "AWS, GCP, Azure, Supabase, Neon, Hetzner, Fly.io, on-prem." },
      { q: "De ce nu Vantage sau Infracost?", a: "Ele raportează costul. Infrared propune schimbarea." },
    ],
  },
  footer: {
    title: "Infrastructura urmează proiectele.",
    back: "Sus",
    tokensLink: "Tokenuri de design",
    productLink: "Înapoi la produs",
    product: "Produs",
    resources: "Resurse",
    prompt: "infrared run",
    promptNote: "Read-only. Un proiect demo e suficient.",
    copy: "copiază comanda",
    copied: "copiat",
  },
  tokens: {
    title: "Tokenuri de design",
    lead: "Schimbă o culoare aici, vezi contrastul, apoi copiază blocul în src/tokens.css.",
    colors: "Culori",
    pairs: "Contrast text pe fundal (WCAG AA)",
    pass: "Trece",
    fail: "Nu trece",
    copy: "Copiază tokens.css",
    copied: "Copiat",
    reset: "Resetează",
  },
};

const en: Content = {
  skipLink: "Skip to content",
  languageLabel: "Language",
  tagline: "infrastructure per project",
  nav: { cta: "Run an analysis", progress: "Page sections", sections: ["Home", "What it finds", "A run", "Plan", "How it works", "Pricing", "Questions", "End"] },
  hero: {
    title: "Infrastructure, replanned around every project.",
    lead: "Reads your cloud. Proposes the move. Rehearses it in a sandbox. Hands you the steps.",
    primary: "Run an analysis",
    secondary: "See a sample run",
    scene: {
      label: "Two infrastructure islands: racks, links, and small containers travelling between them.",
    },
  },
  run: {
    title: "The plan, as a diff.",
    body: "Read-only. Every change has an implementation step.",
    label: "sample run, demo project",
    copy: "copy",
    copied: "copied",
  },
  finds: {
    title: "What it finds.",
    criteria: { cost: "Cost", availability: "Availability", database: "Databases" },
    waste: { value: "29%", label: "of IaaS/PaaS spend is wasted", source: "Flexera 2026" },
    items: [
      { name: "Idle and orphan resources", detail: "Instances, volumes, IPs with no traffic.", criterion: "cost" },
      { name: "Rightsizing", detail: "From measured CPU and RAM.", criterion: "cost" },
      { name: "GPU and tokens", detail: "Idle capacity; costly LLM spend.", criterion: "cost" },
      { name: "No fallback", detail: "One zone or node takes it down.", criterion: "availability" },
      { name: "Hot tables", detail: "From pg_stat_statements.", criterion: "database" },
      { name: "Mixed domains", detail: "Splits, replicas, partitions.", criterion: "database" },
    ],
  },
  cluster: {
    title: "The plan, as a cluster map.",
    lead: "Each project is a cluster. Nodes are resources; size is monthly cost, colour is provider. The dashed outline is the proposed change.",
    plan: "Plan",
    reset: "Reset",
    infrared: "Infrared view",
  },
  how: {
    title: "How it works.",
    steps: [
      { title: "Reads", body: "Resources, metrics, schemas. Read-only." },
      { title: "Decides", body: "Per project: cost, availability, zones." },
      { title: "Rehearses", body: "Traffic and failures, in a sandbox." },
      { title: "Applies", body: "Pull request. You approve, your CI applies." },
    ],
    promise: "Read-only. Never applies a change itself.",
  },
  pricing: {
    title: "Pricing.",
    plans: [
      { name: "Pack", price: "490 USD", unit: "5 runs", detail: "98 USD a run." },
      { name: "Subscription", price: "199 USD", unit: "a month", detail: "Scheduled runs." },
    ],
    consultant: "A consultant review starts at 495 USD.",
    billingNote: "Billed per company.",
  },
  faq: {
    title: "Questions.",
    items: [
      { q: "What access does it need?", a: "Read-only: AWS describe and list, CloudWatch, Postgres, GitHub." },
      { q: "How does a change reach production?", a: "As a pull request. You approve it, your CI applies it." },
      { q: "Where can it move?", a: "AWS, GCP, Azure, Supabase, Neon, Hetzner, Fly.io, on-prem." },
      { q: "Why not Vantage or Infracost?", a: "They report the cost. Infrared proposes the change." },
    ],
  },
  footer: {
    title: "Infrastructure follows the projects.",
    back: "Top",
    tokensLink: "Design tokens",
    productLink: "Back to the product",
    product: "Product",
    resources: "Resources",
    prompt: "infrared run",
    promptNote: "Read-only. A demo project is enough.",
    copy: "copy command",
    copied: "copied",
  },
  tokens: {
    title: "Design tokens",
    lead: "Change a colour here, check the contrast, then copy the block into src/tokens.css.",
    colors: "Colours",
    pairs: "Text on background contrast (WCAG AA)",
    pass: "Pass",
    fail: "Fail",
    copy: "Copy tokens.css",
    copied: "Copied",
    reset: "Reset",
  },
};

export const content: Record<Language, Content> = { ro, en };
