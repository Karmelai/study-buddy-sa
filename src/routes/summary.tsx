import { createFileRoute } from "@tanstack/react-router";
import { SmartExtractToolPage } from "./extract";

export const Route = createFileRoute("/summary")({
  head: () => ({ meta: [{ title: "Summary - KARMEL" }] }),
  component: () => <SmartExtractToolPage tool="summary" />,
});
