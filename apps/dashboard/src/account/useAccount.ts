import { useEffect, useState } from "react";
import type { Account, AccountSource } from "~/account/accountSource";

export function useAccount(source: AccountSource): Account | null {
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    source
      .load(controller.signal)
      .then((loaded) => {
        if (!controller.signal.aborted) setAccount(loaded);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAccount(null);
      });
    return () => controller.abort();
  }, [source]);

  return account;
}
