import { Bot, ChevronDown, Settings } from "lucide-react";
import { AgentSidebarProps } from "../types";

export default function AgentSidebar({
  assistantDisplayName,
  appName,
  apps,
  selectedApp,
  onSelectApp,
}: AgentSidebarProps) {
  return (
    <aside className="hidden w-80 shrink-0 border-l border-gray-200 bg-gradient-to-b from-white to-slate-50 lg:flex flex-col shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 p-5 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Agent</h3>
          </div>
          <Settings className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer" />
        </div>
        <p className="text-sm text-gray-600 line-clamp-2 pl-1">
          {assistantDisplayName}
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 p-6 overflow-y-auto">
        {apps.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.5px] text-gray-500">
                Quick Switch
              </h4>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>

            <div className="space-y-1.5">
              {apps.map((app) => {
                const isSelected = selectedApp?.agent_id === app.agent_id;
                return (
                  <button
                    key={app.agent_id}
                    onClick={() => onSelectApp(app)}
                    className={`
                      w-full group flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left
                      transition-all duration-200
                      ${isSelected 
                        ? "bg-blue-600 text-white shadow-sm" 
                        : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"
                      }
                    `}
                  >
                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${isSelected ? "bg-white" : "bg-emerald-400"}`} />
                    <span className="font-medium text-sm tracking-tight">
                      {app.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}