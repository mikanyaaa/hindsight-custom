import {
  File,
  FileText,
  History,
  Home,
  Image,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export type FrameView =
  | "home"
  | "recall"
  | "reflect"
  | "data"
  | "documents"
  | "entities"
  | "pages"
  | "profile";

export interface FrameNavItem {
  id: FrameView;
  icon: LucideIcon;
  /** Shown as its own tab on a phone. The rest live under More. */
  primary: boolean;
}

export const FRAME_NAV: FrameNavItem[] = [
  { id: "home", icon: Home, primary: true },
  { id: "recall", icon: History, primary: true },
  { id: "data", icon: Image, primary: true },
  { id: "pages", icon: File, primary: true },
  { id: "reflect", icon: Sparkles, primary: false },
  { id: "documents", icon: FileText, primary: false },
  { id: "entities", icon: Users, primary: false },
  { id: "profile", icon: Settings, primary: false },
];

export const PRIMARY_NAV = FRAME_NAV.filter((item) => item.primary);
export const MORE_NAV = FRAME_NAV.filter((item) => !item.primary);
