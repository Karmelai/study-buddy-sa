import { createFileRoute } from "@tanstack/react-router";
import { SmartExtractToolPage } from "./extract";

export const Route = createFileRoute("/test")({
  head: () => ({ meta: [{ title: "Test - KARMEL" }] }),
  component: () => <SmartExtractToolPage tool="test" />,
});
