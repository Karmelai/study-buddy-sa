import { Radio } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRadio } from "./useRadio";

export function RadioToggle() {
  const { isPlaying, setOpenPanel } = useRadio();

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="karmel-radio-toggle"
            onClick={() => setOpenPanel(true)}
            aria-label="Open Karmel Radio player"
          >
            <Radio aria-hidden="true" size={21} />
            {isPlaying && <span className="karmel-radio-live-pulse" aria-hidden="true" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Open Karmel Radio</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
