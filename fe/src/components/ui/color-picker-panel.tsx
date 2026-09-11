import * as React from "react";
import { HexColorPicker } from "react-colorful";
import { Pipette } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ColorSwatchChip } from "@/components/ui/color-swatch-chip";
import { hexToRgb, normalizeHexColor, resolvePickerHex, rgbToHex } from "@/components/ui/color-utils";

type ColorPickerPanelProps = {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
};

type RgbChannel = "r" | "g" | "b";

function RgbField({
  channel,
  value,
  onChange,
}: {
  channel: RgbChannel;
  value: number;
  onChange: (channel: RgbChannel, next: number) => void;
}) {
  const [draft, setDraft] = React.useState(String(value));

  React.useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <div className="flex h-7 min-w-0 items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white shadow-theme-xs dark:border-gray-700 dark:bg-white/[0.03]">
      <span className="flex w-5 shrink-0 items-center justify-center bg-gray-50 text-[9px] font-semibold uppercase text-gray-400 dark:bg-white/[0.04] dark:text-gray-500">
        {channel}
      </span>
      <input
        className="min-w-0 flex-1 border-0 bg-transparent px-0.5 text-center font-mono text-[11px] tabular-nums text-gray-800 focus:outline-none dark:text-white/90"
        inputMode="numeric"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          const parsed = Number.parseInt(next, 10);
          if (!Number.isNaN(parsed)) onChange(channel, parsed);
        }}
        onBlur={() => setDraft(String(value))}
        aria-label={`${channel.toUpperCase()} 分量`}
      />
    </div>
  );
}

export function ColorPickerPanel({ value, onChange, className }: ColorPickerPanelProps) {
  const lastValidHexRef = React.useRef("#ffffff");
  const normalized = normalizeHexColor(value);
  if (normalized) lastValidHexRef.current = normalized;
  const hex = resolvePickerHex(value, lastValidHexRef.current);
  const rgb = hexToRgb(hex) ?? { r: 255, g: 255, b: 255 };
  const canEyeDrop = typeof window !== "undefined" && "EyeDropper" in window;

  const handleRgbChange = (channel: RgbChannel, next: number) => {
    onChange(
      rgbToHex(
        channel === "r" ? next : rgb.r,
        channel === "g" ? next : rgb.g,
        channel === "b" ? next : rgb.b,
      ),
    );
  };

  const pickFromScreen = async () => {
    if (!canEyeDrop) return;
    try {
      const EyeDropperCtor = (
        window as Window & { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }
      ).EyeDropper;
      const dropper = new EyeDropperCtor();
      const result = await dropper.open();
      onChange(result.sRGBHex.toLowerCase());
    } catch {
      // user cancelled
    }
  };

  return (
    <div className={cn("vs-color-picker", className)}>
      <HexColorPicker color={hex} onChange={(next) => onChange(next.toLowerCase())} />
      <div className="mt-2 flex items-center gap-1.5">
        <IconButton
          type="button"
          variant="outline"
          size="xs"
          className="size-7 shrink-0 rounded-lg shadow-theme-xs"
          onClick={() => void pickFromScreen()}
          disabled={!canEyeDrop}
          showTooltip={false}
          tooltip={canEyeDrop ? "从屏幕取色" : "当前浏览器不支持屏幕取色"}
          aria-label="从屏幕取色"
        >
          <Pipette className="size-3.5" aria-hidden />
        </IconButton>
        <ColorSwatchChip color={hex} size="lg" />
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
          <RgbField channel="r" value={rgb.r} onChange={handleRgbChange} />
          <RgbField channel="g" value={rgb.g} onChange={handleRgbChange} />
          <RgbField channel="b" value={rgb.b} onChange={handleRgbChange} />
        </div>
      </div>
    </div>
  );
}
