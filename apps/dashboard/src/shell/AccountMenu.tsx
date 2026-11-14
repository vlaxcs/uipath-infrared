import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { PageId } from "~/navigation/route";

type AccountMenuProps = {
  login?: string | null;
  avatarUrl?: string | null;
  onNavigate: (page: PageId) => void;
  onDisconnect: () => void;
};

const ITEMS: { label: string; page?: PageId }[] = [
  { label: "Configuration", page: "configuration" },
  { label: "Account", page: "account" },
  { label: "Disconnect" },
];

export function AccountMenu({ login, avatarUrl, onNavigate, onDisconnect }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (open) items.current[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!(event.target instanceof Node) || button.current?.parentElement?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const choose = (item: (typeof ITEMS)[number]) => {
    setOpen(false);
    if (item.page) onNavigate(item.page);
    else onDisconnect();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.current.findIndex((item) => item === document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items.current[(index + step + ITEMS.length) % ITEMS.length]?.focus();
    }
  };

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-pill border border-border bg-surface text-label font-medium text-fg-muted hover:bg-surface-muted"
      >
        {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (login?.[0]?.toUpperCase() ?? "?")}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={onKeyDown}
          className="absolute right-0 top-full z-20 mt-2 flex w-48 flex-col rounded-card border border-border bg-surface p-1 shadow-sm"
        >
          {login ? <p className="px-3 py-2 text-caption text-fg-subtle">Signed in as {login}</p> : null}
          {ITEMS.map((item, index) => (
            <button
              key={item.label}
              ref={(element) => {
                items.current[index] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => choose(item)}
              className="rounded-control px-3 py-2 text-left text-label text-fg hover:bg-surface-muted focus-visible:bg-surface-muted"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
