import { LANG_OPTIONS, useI18n, type LangKey } from "@/i18n";
import { Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LanguageSwitcherProps {
  /** Compact variant for sidebars / login pages. */
  compact?: boolean;
}

/**
 * Language picker rendered as a Radix Select. Uses the i18n context so that
 * changing the value live-updates every translated string in the tree.
 */
export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      className={
        compact
          ? "flex items-center gap-2"
          : "flex items-center gap-2 text-xs"
      }
    >
      <Languages className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <span className="sr-only">{t("common.language")}</span>
      <Select value={lang} onValueChange={(v) => setLang(v as LangKey)}>
        <SelectTrigger
          className={
            compact
              ? "h-8 w-[140px] font-mono text-xs uppercase tracking-wider"
              : "h-9 w-[160px] font-mono text-xs uppercase tracking-wider"
          }
          aria-label={t("common.language")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="font-mono text-xs">
          {LANG_OPTIONS.map((opt) => (
            <SelectItem key={opt.code} value={opt.code}>
              <span className="tabular-nums">[{opt.code.toUpperCase()}]</span>{" "}
              {opt.native}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
