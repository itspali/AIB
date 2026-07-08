"use client";

import { CircleHelp } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Switch } from "@/components/ui/switch";
import { editorFieldInlineHintClass, editorSwitchSize, useEditorPanelLayout } from "@/lib/products/editor-chrome";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "aib.item-editor.show-field-help";

type EditorFieldHelpContextValue = {
  showFieldHelp: boolean;
  setShowFieldHelp: (value: boolean) => void;
  toggleShowFieldHelp: () => void;
};

const EditorFieldHelpContext = createContext<EditorFieldHelpContextValue | null>(null);

function readStoredShowFieldHelp(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function EditorFieldHelpProvider({ children }: { children: ReactNode }) {
  const [showFieldHelp, setShowFieldHelp] = useState(false);

  useEffect(() => {
    setShowFieldHelp(readStoredShowFieldHelp());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, showFieldHelp ? "1" : "0");
  }, [showFieldHelp]);

  const toggleShowFieldHelp = useCallback(() => {
    setShowFieldHelp((value) => !value);
  }, []);

  const value = useMemo(
    () => ({ showFieldHelp, setShowFieldHelp, toggleShowFieldHelp }),
    [showFieldHelp, toggleShowFieldHelp]
  );

  return (
    <EditorFieldHelpContext.Provider value={value}>{children}</EditorFieldHelpContext.Provider>
  );
}

export function useEditorFieldHelp() {
  const context = useContext(EditorFieldHelpContext);
  return context?.showFieldHelp ?? false;
}

export function useEditorFieldHelpControls() {
  const context = useContext(EditorFieldHelpContext);
  if (!context) {
    return {
      showFieldHelp: false,
      setShowFieldHelp: () => undefined,
      toggleShowFieldHelp: () => undefined,
    };
  }
  return context;
}

export function EditorFieldInlineHint({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const panel = useEditorPanelLayout();
  if (!children) return null;
  return <p className={cn(editorFieldInlineHintClass(panel), className)}>{children}</p>;
}

export function EditorFieldHelpToggle({ className }: { className?: string }) {
  const { showFieldHelp, setShowFieldHelp } = useEditorFieldHelpControls();
  const panel = useEditorPanelLayout();
  const switchId = "editor-field-help-toggle";

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2",
        panel ? "text-xs" : "text-sm",
        className
      )}
    >
      <label
        htmlFor={switchId}
        className={cn(
          "inline-flex cursor-pointer select-none items-center gap-1.5 font-medium text-muted-foreground",
          panel ? "text-xs" : "text-sm"
        )}
      >
        <CircleHelp className={panel ? "size-3.5" : "size-4"} aria-hidden />
        Show help
      </label>
      <Switch
        id={switchId}
        size={editorSwitchSize}
        checked={showFieldHelp}
        onCheckedChange={setShowFieldHelp}
        aria-label="Show field help"
      />
    </div>
  );
}
