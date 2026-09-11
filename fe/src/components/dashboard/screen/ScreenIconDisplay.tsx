import {
  AlertCircle,
  Bell,
  Calendar,
  Camera,
  Check,
  Clock,
  Compass,
  Download,
  Eye,
  Filter,
  Headphones,
  Heart,
  Home,
  Image,
  Info,
  Link,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  Music,
  Pencil,
  Phone,
  PieChart,
  Plus,
  Power,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  SlidersHorizontal,
  Star,
  Trash2,
  Unlock,
  Upload,
  User,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { normalizeScreenIconStyle, type ScreenIconStyleConfig } from "@/lib/screenVisualStyle";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  search: Search,
  plus: Plus,
  minus: Minus,
  star: Star,
  heart: Heart,
  bell: Bell,
  user: User,
  settings: Settings,
  clock: Clock,
  calendar: Calendar,
  mail: Mail,
  phone: Phone,
  "map-pin": MapPin,
  camera: Camera,
  image: Image,
  video: Video,
  music: Music,
  download: Download,
  upload: Upload,
  "refresh-cw": RefreshCw,
  check: Check,
  x: X,
  info: Info,
  "alert-circle": AlertCircle,
  "trash-2": Trash2,
  pencil: Pencil,
  filter: Filter,
  eye: Eye,
  lock: Lock,
  unlock: Unlock,
  link: Link,
  "share-2": Share2,
  send: Send,
  "message-circle": MessageCircle,
  headphones: Headphones,
  compass: Compass,
  "pie-chart": PieChart,
  power: Power,
  "sliders-horizontal": SlidersHorizontal,
};

export function resolveScreenIcon(icon?: string): LucideIcon {
  return ICON_MAP[icon ?? "star"] ?? Star;
}

export type ScreenIconDisplayProps = {
  className?: string;
  styleConfig?: ScreenIconStyleConfig;
};

export function ScreenIconDisplay({ className, styleConfig }: ScreenIconDisplayProps) {
  const style = normalizeScreenIconStyle(styleConfig);
  const Icon = resolveScreenIcon(style.icon);

  return (
    <div
      className={cn("pointer-events-none flex size-full min-h-0 items-center justify-center", className)}
      data-screen-icon
      aria-hidden
    >
      <Icon style={{ width: style.size, height: style.size, color: style.color }} strokeWidth={1.5} />
    </div>
  );
}

export function ScreenIconPreview({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Icon = resolveScreenIcon(icon);
  return (
    <div className={cn("flex aspect-square w-full items-center justify-center rounded-md bg-[#0a0e14]", className)}>
      <Icon className="size-5 text-gray-300" strokeWidth={1.5} aria-hidden />
    </div>
  );
}
