import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";

export default defineConfig({
  extends: [core, react, tanstack],
  ignorePatterns: core.ignorePatterns,
  overrides: [
    {
      files: ["packages/db/src/schema/auth.ts"],
      rules: {
        "no-inline-comments": "off",
      },
    },
    {
      files: ["packages/ui/src/components/label.tsx"],
      rules: {
        "jsx-a11y/label-has-associated-control": "off",
      },
    },
    {
      files: ["packages/ui/src/components/input-group.tsx"],
      rules: {
        "jsx-a11y/click-events-have-key-events": "off",
        "jsx-a11y/no-noninteractive-element-interactions": "off",
        "jsx-a11y/prefer-tag-over-role": "off",
      },
    },
    {
      files: ["apps/server/src/index.ts"],
      rules: {
        "promise/prefer-await-to-callbacks": "off",
      },
    },
  ],
});
