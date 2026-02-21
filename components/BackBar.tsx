"use client";

import { useRouter } from "next/navigation";

export default function BackBar({
  title,
  fallbackHref = "/",
}: {
  title?: string;
  fallbackHref?: string;
}) {
  const router = useRouter();

  function goBack() {
    // If user opened /inventory directly from home screen,
    // router.back() may do nothing. So we fallback to "/".
    if (typeof window !== "undefined" && window.history.length <= 1) {
      router.push(fallbackHref);
      return;
    }
    router.back();
  }

  return (
    <div className="sticky top-0 z-50 bg-black/70 backdrop-blur border-b border-white/10">
      <div className="mx-auto w-full max-w-md px-3 py-3 flex items-center gap-2">
        <button
          onClick={goBack}
          className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-white/10"
        >
          ← Back
        </button>

        <div className="flex-1 text-center text-sm font-semibold text-white/80">
          {title ?? ""}
        </div>

        <div className="w-[72px]" />
      </div>
    </div>
  );
}
