import { Menubar } from "../components/Menubar/Menubar";
import { ProjectRoutes } from "../routes/ProjectRoutes";
import { useOrgValidation } from "../hooks/useOrgValidation";
import { useMemo } from "react";

export const RootPage = ({ content }) => {
  useOrgValidation();
  const pinned = localStorage.getItem("sidebar-pinned") === "true";
  const opened = pinned && localStorage.getItem("sidebar-opened") === "true";

  // Check if header should be hidden (for iframe embedding)
  // Use URL parameter directly without sessionStorage
  const hideHeader = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("hideHeader") === "true";
  }, [window.location.search]);

  return (
    <Menubar
      enabled={!hideHeader}
      defaultOpened={opened}
      defaultPinned={pinned}
      onSidebarToggle={(visible) => localStorage.setItem("sidebar-opened", visible)}
      onSidebarPin={(pinned) => localStorage.setItem("sidebar-pinned", pinned)}
    >
      <ProjectRoutes content={content} />
    </Menubar>
  );
};
