import { SUPPORT_EMAIL } from "@/lib/support";

export function SupportEmail() {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="underline font-mono">
      {SUPPORT_EMAIL}
    </a>
  );
}
