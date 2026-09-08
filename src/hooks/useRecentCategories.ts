import { useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { accessMode } from "@/src/api/accessMode";
import { pushRecent } from "@/src/lib/recentCategories";

const KEY = "mc-recent-categories";

/**
 * Device-local "most recently used" category list, shown above the grouped
 * list in `CategoryPickerSheet`. Same persist/hydrate/logout-clear shape as
 * `useCollapsedGroups` — a UI preference, not account data, so it lives in
 * SecureStore next to the other device prefs rather than the encrypted
 * category cache.
 */
export function useRecentCategories() {
  const [recents, setRecents] = useState<string[]>([]);
  // Nothing is written until the stored value has landed — the initial empty
  // list would otherwise overwrite it on every mount.
  const hydrated = useRef(false);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((raw) => {
        if (raw) setRecents(JSON.parse(raw) as string[]);
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true;
      });

    // Otherwise the next account signed into on this device inherits the
    // previous one's recently-used categories.
    return accessMode.subscribeLogout(() => {
      hydrated.current = false;
      setRecents([]);
      SecureStore.deleteItemAsync(KEY).catch(() => {});
    });
  }, []);

  function record(name: string) {
    setRecents((prev) => {
      const next = pushRecent(prev, name);
      if (hydrated.current) {
        SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {});
      }
      return next;
    });
  }

  return { recents, record };
}
