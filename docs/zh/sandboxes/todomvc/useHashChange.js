import { useEffect } from "react";

export function useHashChange(onHashChange) {
  useEffect(() => {
    window.addEventListener("hashchange", onHashChange);

    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
}
