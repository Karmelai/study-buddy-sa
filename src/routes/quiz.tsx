import { createFileRoute } from "@tanstack/react-router";
import { SmartExtractToolPage } from "./extract";

export const Route = createFileRoute("/quiz")({
  head: () => ({ meta: [{ title: "Quiz - KARMEL" }] }),
  component: () => <SmartExtractToolPage tool="quiz" />,
});
