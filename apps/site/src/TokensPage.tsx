import { useEffect, useState } from "react";
import type { Content } from "./content.ts";
import tokensCss from "./tokens.css?raw";
import { colorPairs, contrastRatio, parseColorTokens, requiredRatio, themeBlock, type ColorToken } from "./tokens.ts";

const initialTokens = parseColorTokens(tokensCss);

export default function TokensPage({ text }: { text: Content }) {
  const [tokens, setTokens] = useState<ColorToken[]>(initialTokens);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    for (const token of tokens) {
      document.documentElement.style.setProperty(`--color-${token.name}`, token.value);
    }
  }, [tokens]);

  const valueOf = (name: string) => tokens.find((token) => token.name === name)?.value ?? "#000000";

  const updateToken = (name: string, value: string) => {
    setCopied(false);
    setTokens((current) => current.map((token) => (token.name === name ? { name, value } : token)));
  };

  const resetTokens = () => {
    setCopied(false);
    setTokens(initialTokens);
  };

  const copyCss = async () => {
    try {
      await navigator.clipboard.writeText(themeBlock(tokens, tokensCss));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-28 sm:px-8">
      <div className="flex flex-col gap-4">
        <h1 className="type-h1 text-fg">{text.tokens.title}</h1>
        <p className="max-w-3xl text-fg-muted">{text.tokens.lead}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={copyCss} className="type-button min-h-11 rounded-[2px] bg-accent px-5 text-on-accent hover:bg-accent-lip">
            {copied ? text.tokens.copied : text.tokens.copy}
          </button>
          <button
            type="button"
            onClick={resetTokens}
            className="min-h-11 rounded-[2px] border border-fg px-5 hover:bg-fg hover:text-canvas"
          >
            {text.tokens.reset}
          </button>
        </div>
      </div>

      <section aria-labelledby="colors-title" className="flex flex-col gap-4">
        <h2 id="colors-title" className="type-h3 text-fg">{text.tokens.colors}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tokens.map((token) => (
            <li key={token.name} className="flex items-center gap-4 rounded-well border border-line bg-surface p-3">
              <input
                id={`token-${token.name}`}
                type="color"
                aria-label={`--color-${token.name}`}
                value={token.value}
                onChange={(event) => updateToken(token.name, event.target.value)}
                className="h-12 w-12 shrink-0 cursor-pointer rounded-none border border-line bg-transparent"
              />
              <label htmlFor={`token-${token.name}`} className="flex flex-col">
                <span className="type-label">--color-{token.name}</span>
                <span className="font-mono type-tag text-fg-muted">{token.value}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pairs-title" className="flex flex-col gap-4">
        <h2 id="pairs-title" className="type-h3 text-fg">{text.tokens.pairs}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {colorPairs.map((pair) => {
            const ratio = contrastRatio(valueOf(pair.text), valueOf(pair.background));
            const passes = ratio >= requiredRatio(pair);
            return (
              <li
                key={`${pair.text}-${pair.background}`}
                className="flex flex-col gap-2 rounded-well border border-line p-4"
                style={{ backgroundColor: valueOf(pair.background), color: valueOf(pair.text) }}
              >
                <span className="type-label">
                  {pair.text} / {pair.background}
                </span>
                <span className="flex items-center gap-2 self-start rounded-[2px] border border-line bg-canvas px-2 py-1 text-fg">
                  <span aria-hidden="true">{passes ? "✓" : "✕"}</span>
                  {passes ? text.tokens.pass : text.tokens.fail} · {ratio.toFixed(2)}:1
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

