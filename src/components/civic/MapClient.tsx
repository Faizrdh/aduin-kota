/*eslint-disable*/

import { lazy, Suspense, useEffect, useState } from "react";
import type { ComponentProps } from "react";

const CivicMap = lazy(() =>
  import("./CivicMap").then((m) => ({ default: m.CivicMap }))
);

export function MapClient(props: ComponentProps<typeof CivicMap>) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) {
    return (
      <div
        style={{ height: props.height ?? "100%" }}
        className="rounded-2xl glass-strong flex items-center justify-center"
      >
        <div className="text-muted-foreground text-sm flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          Memuat Peta
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div
          style={{ height: props.height ?? "100%" }}
          className="rounded-2xl glass-strong"
        />
      }
    >
      {/* Semua props termasuk flyTo diteruskan langsung ke CivicMap */}
      <CivicMap {...props} />
    </Suspense>
  );
}