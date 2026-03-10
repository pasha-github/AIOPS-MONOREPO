"use client";

import { Plug, Search } from "lucide-react";
import { useState } from "react";
import CreateConnectorButton from "./CreateConnectorButton";
import DisplayConnectors from "./DisplayConnectors";

export default function ConnectorsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <section className="min-h-[calc(100vh-160px)] rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="flex items-center gap-3 text-2xl font-semibold text-[#10131a]">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
            <Plug className="h-5 w-5" />
          </span>
          Credentials management
        </h2>
        <div className="flex flex-1 justify-center">
          <div
            className={`flex items-center gap-2 rounded-xl bg-[#eef2ff] px-4 py-2 text-sm text-[#4f49e2] transition-all duration-200 ${
              isSearchFocused ? "w-64" : "w-44"
            }`}
          >
            <Search className="h-4 w-4" />
            <input
              type="text"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Search credentials.."
              className="w-full bg-transparent text-sm text-[#4f49e2] placeholder:text-[#4f49e2] focus:outline-none"
            />
          </div>
        </div>
        <div className="ml-auto">
          <CreateConnectorButton
            onCreated={() => setRefreshKey((prev) => prev + 1)}
          />
        </div>
      </div>
      <CreateConnectorButton
        onCreated={() => setRefreshKey((prev) => prev + 1)}
        renderTrigger={({ open }) => (
          <DisplayConnectors
            refreshKey={refreshKey}
            searchTerm={searchValue}
            onAddConnector={open}
          />
        )}
      />
    </section>
  );
}
