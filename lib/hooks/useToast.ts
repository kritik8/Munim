/**
 * lib/hooks/useToast.ts
 * Lightweight toast notification utility.
 * Uses browser's native console + custom events for now;
 * can be replaced with a full toast library later.
 */

type ToastType = "info" | "error" | "success";

export const toast = {
  info: (msg: string) => dispatchToast("info", msg),
  error: (msg: string) => dispatchToast("error", msg),
  success: (msg: string) => dispatchToast("success", msg),
};

function dispatchToast(type: ToastType, message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("munim:toast", { detail: { type, message } })
  );
}

