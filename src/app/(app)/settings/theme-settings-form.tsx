"use client";

import { useState } from "react";
import { Notice, Surface } from "@/components/app-ui";
import { type AppTheme, appTheme, themeCookieName } from "@/lib/theme";

export function ThemeSettingsForm({
  initialTheme,
}: {
  initialTheme: AppTheme;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [saved, setSaved] = useState(false);

  function saveTheme() {
    // biome-ignore lint/suspicious/noDocumentCookie: The Cookie Store API is not available in all supported browsers.
    document.cookie = `${themeCookieName}=${theme}; Max-Age=31536000; Path=/; SameSite=Lax`;
    document
      .querySelector("[data-app-theme]")
      ?.setAttribute("data-app-theme", theme);
    setSaved(true);
  }

  return (
    <Surface
      as="form"
      onSubmit={(event) => {
        event.preventDefault();
        saveTheme();
      }}
      className="mt-4 p-5"
    >
      <h2 className="text-lg font-semibold">Appearance</h2>
      {saved ? (
        <Notice tone="success" className="mt-5">
          Appearance updated.
        </Notice>
      ) : null}
      <label className="mt-5 block text-sm font-medium" htmlFor="theme">
        Theme
      </label>
      <select
        id="theme"
        name="theme"
        value={theme}
        onChange={(event) => {
          setTheme(appTheme(event.target.value));
          setSaved(false);
        }}
        className="mt-2 h-10 w-full rounded-md border border-foreground/15 bg-background px-3 text-sm outline-none focus:border-foreground/40"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <button
        type="submit"
        className="mt-5 inline-flex h-10 items-center rounded-md bg-[var(--selected-control-bg)] px-4 text-sm font-semibold text-[var(--selected-control-fg)] hover:opacity-90"
      >
        Save appearance
      </button>
    </Surface>
  );
}
