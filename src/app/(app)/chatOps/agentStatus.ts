import type { AppItem } from "./types";

export const getAgentDisplayStatus = (app: AppItem) => {
  if (app.isEnabled === false) {
    return "inactive";
  }

  const target = app.deployment_target?.trim().toLowerCase();
  if (target === "vertex") {
    return app.vertex_deployment_status ?? app.status;
  }

  return app.status;
};

export const isSelectableStatus = (app: AppItem) => {
  const normalized = getAgentDisplayStatus(app)?.trim().toLowerCase() ?? "";
  return (
    normalized === "active" ||
    normalized === "deployed" ||
    normalized === "online" ||
    normalized === "started"
  );
};
