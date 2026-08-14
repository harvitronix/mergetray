import { Surface } from "@/components/app-ui";
import {
  type InboxRuleId,
  inboxRuleCatalog,
  inboxSectionDefinitions,
} from "@/lib/inbox-section-rules";

export function SectionRulesSettings() {
  return (
    <Surface className="mt-4 p-5">
      <h2 className="text-lg font-semibold">Inbox sections</h2>
      <p className="mt-2 text-sm text-foreground/55">
        The first matching section wins. Drafts stay lower in the inbox so
        active review work stays prominent.
      </p>
      <div className="mt-5 grid gap-3">
        {inboxSectionDefinitions.map((section) => (
          <Surface key={section.id} variant="inset" className="px-3 py-3">
            <h3 className="font-semibold">{section.label}</h3>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <RuleList
                label="Qualifiers"
                items={uniqueItems(
                  section.rules.flatMap((rule) => rule.qualifiers),
                )}
                tone="success"
              />
              <RuleList
                label="Disqualifiers"
                items={uniqueItems(
                  section.rules.flatMap((rule) => rule.disqualifiers ?? []),
                )}
                tone="danger"
              />
            </div>
          </Surface>
        ))}
      </div>
    </Surface>
  );
}

function uniqueItems(items: InboxRuleId[]) {
  return Array.from(new Set(items));
}

function RuleList({
  label,
  items,
  tone,
}: {
  label: string;
  items: InboxRuleId[];
  tone: "danger" | "success";
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-foreground/45">
        {label}
      </p>
      {items.length ? (
        <ul className="mt-2 grid gap-1.5">
          {items.map((item) => (
            <li
              key={item}
              className={`rounded-md px-2.5 py-2 ${
                tone === "success"
                  ? "bg-emerald-500/10 text-[var(--success-text)]"
                  : "bg-red-500/10 text-[var(--danger-text)]"
              }`}
            >
              {inboxRuleCatalog[item].label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 rounded-md bg-foreground/5 px-2.5 py-2 text-foreground/55">
          None.
        </p>
      )}
    </div>
  );
}
