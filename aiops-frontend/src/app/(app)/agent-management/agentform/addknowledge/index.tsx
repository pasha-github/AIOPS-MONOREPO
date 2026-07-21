"use client";

import { FileText, Link2, Paperclip } from "lucide-react";
import { useState } from "react";
import EndpointUrlKnowledge, { type KnowledgeSource } from "./endpoint-url";
import FileUploadKnowledge, { type KnowledgeFileRecord } from "./file-upload";

type KnowledgeTab = "files" | "sources";

type AddKnowledgeProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  existingFiles?: KnowledgeFileRecord[];
  onDownloadExistingFile?: (file: KnowledgeFileRecord) => void;
  onRemoveExistingFile?: (file: KnowledgeFileRecord) => void;
};

export default function AddKnowledge({
  files,
  onFilesChange,
  existingFiles,
  onDownloadExistingFile,
  onRemoveExistingFile,
}: AddKnowledgeProps) {
  const [activeTab, setActiveTab] = useState<KnowledgeTab>("files");
  const [sources, setSources] = useState<KnowledgeSource[]>([]);

  return (
    <div className="col-span-2">
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
        <FileText size={18} />
        Add Knowledge
      </label>
      <p className="mt-1 text-xs leading-snug text-gray-400">
        Attach files or add endpoint sources for extra agent context.
      </p>

      <div className="mt-3 rounded-2xl border border-indigo-100 p-2">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-1 shadow-[0_12px_30px_-26px_rgba(79,70,229,0.65)]">
          <button
            type="button"
            onClick={() => setActiveTab("files")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === "files"
                ? "bg-indigo-600 text-white shadow-[0_12px_22px_-18px_rgba(79,70,229,0.9)]"
                : "text-gray-500 hover:bg-indigo-50 hover:text-indigo-700"
            }`}
          >
            <Paperclip size={14} />
            File Upload
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sources")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === "sources"
                ? "bg-indigo-600 text-white shadow-[0_12px_22px_-18px_rgba(79,70,229,0.9)]"
                : "text-gray-500 hover:bg-indigo-50 hover:text-indigo-700"
            }`}
          >
            <Link2 size={14} />
            Endpoint URL
          </button>
        </div>

        {activeTab === "files" ? (
          <FileUploadKnowledge
            files={files}
            onFilesChange={onFilesChange}
            existingFiles={existingFiles}
            onDownloadExistingFile={onDownloadExistingFile}
            onRemoveExistingFile={onRemoveExistingFile}
          />
        ) : (
          <EndpointUrlKnowledge sources={sources} onSourcesChange={setSources} />
        )}
      </div>
    </div>
  );
}
