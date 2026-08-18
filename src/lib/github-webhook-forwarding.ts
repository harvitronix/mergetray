export type GithubWebhook = {
  id: number;
  name: string;
  config: { url?: string };
};

export function githubCliForwardingHookIds(hooks: GithubWebhook[]) {
  return hooks
    .filter(
      (hook) =>
        hook.name === "cli" &&
        hook.config.url === "https://webhook-forwarder.github.com/hook",
    )
    .map((hook) => hook.id);
}
