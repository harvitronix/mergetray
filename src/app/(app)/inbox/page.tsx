import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { AppPage } from "@/components/app-ui";
import { attachAgentSessionLinks } from "@/lib/agent-sessions";
import { codexIntegrationEnabled } from "@/lib/codex-integration";
import { inboxLayout, inboxLayoutCookieName } from "@/lib/inbox-layout";
import {
  githubIdentityConfigured,
  listInboxRows,
  listRepositories,
  setUserNote as saveUserNote,
  setShipItPromotion,
  setUserStatus,
  snoozeInboxItem,
} from "@/lib/inbox-store";
import { InboxTable } from "./inbox-table";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    author?: string;
    layout?: string;
    repo?: string;
    view?: string;
  }>;
}) {
  const query = await searchParams;
  const view = query.view === "done" ? "done" : "active";
  const savedLayout = (await cookies()).get(inboxLayoutCookieName)?.value;
  const layout = inboxLayout(query.layout ?? savedLayout);
  const selectedAuthor = query.author?.replace(/^github:/, "") || undefined;
  const repositoryId = query.repo || undefined;
  const codexEnabled = codexIntegrationEnabled();
  const rows = listInboxRows(repositoryId);
  const inbox = codexEnabled ? attachAgentSessionLinks(rows) : rows;
  const repositories = listRepositories();
  const selectedRepository = repositoryId
    ? repositories.find((repository) => repository.id === repositoryId)
    : undefined;
  const inboxStateKey = inbox
    .map(
      (row) =>
        `${row.item.id}:${row.userState?.status ?? "active"}:${row.userState?.snoozedUntil ?? ""}:${row.userState?.note ?? ""}`,
    )
    .join("|");

  async function updateStatus(formData: FormData) {
    "use server";

    const status = String(formData.get("status") ?? "");

    if (status !== "active" && status !== "done") return;

    for (const inboxItemId of formData.getAll("inboxItemId")) {
      setUserStatus(String(inboxItemId), status);
    }
    revalidatePath("/", "layout");
  }

  async function snoozeItem(formData: FormData) {
    "use server";

    const duration = String(formData.get("duration") ?? "");
    const snoozedUntil = Number(formData.get("snoozedUntil"));

    if (
      duration !== "1h" &&
      duration !== "3h" &&
      duration !== "tomorrow" &&
      duration !== "nextWeek"
    ) {
      return;
    }

    for (const inboxItemId of formData.getAll("inboxItemId")) {
      snoozeInboxItem(
        String(inboxItemId),
        duration,
        Number.isFinite(snoozedUntil) ? snoozedUntil : undefined,
      );
    }
    revalidatePath("/", "layout");
  }

  async function promoteToShipIt(formData: FormData) {
    "use server";

    const promoted = formData.get("promoted") === "true";
    for (const inboxItemId of formData.getAll("inboxItemId")) {
      setShipItPromotion(String(inboxItemId), promoted);
    }
    revalidatePath("/", "layout");
  }

  async function setUserNote(formData: FormData) {
    "use server";

    const note = String(formData.get("note") ?? "").trim();

    saveUserNote(String(formData.get("inboxItemId")), note || undefined);
    revalidatePath("/", "layout");
  }

  return (
    <AppPage>
      <InboxTable
        key={`${layout}-${view}-${repositoryId ?? "all"}-${selectedAuthor ?? "all"}-${inboxStateKey}`}
        rows={inbox}
        view={view}
        initialLayout={layout}
        selectedAuthor={selectedAuthor}
        selectedRepositoryId={repositoryId}
        selectedRepository={
          selectedRepository
            ? { fullName: selectedRepository.fullName }
            : undefined
        }
        localGithubIdentityConfigured={githubIdentityConfigured()}
        codexEnabled={codexEnabled}
        updateStatus={updateStatus}
        snoozeItem={snoozeItem}
        promoteToShipIt={promoteToShipIt}
        setUserNote={setUserNote}
      />
    </AppPage>
  );
}
