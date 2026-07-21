"use client";

import { Download, FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

const KNOWLEDGE_FILE_ACCEPT =
  ".pdf,.doc,.docx,.csv,.zip,.html,.htm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,application/zip,text/html";

const ALLOWED_KNOWLEDGE_FILE_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "csv",
  "zip",
  "html",
  "htm",
]);

const getFileExtension = (fileName: string) =>
  fileName.split(".").pop()?.trim().toLowerCase() ?? "";

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

type FileUploadKnowledgeProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  existingFiles?: KnowledgeFileRecord[];
  onDownloadExistingFile?: (file: KnowledgeFileRecord) => void;
  onRemoveExistingFile?: (file: KnowledgeFileRecord) => void;
};

export type KnowledgeFileRecord = {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
};

export const uploadKnowledgeFile = async (
  baseUrl: string,
  file: File
): Promise<KnowledgeFileRecord> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${baseUrl}/agent/files`, {
    method: "POST",
    body: formData,
  });
  const data = await response.json().catch(() => null);

  if (
    !response.ok ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof (data as { id?: unknown }).id !== "string"
  ) {
    throw new Error(`Unable to upload ${file.name}.`);
  }

  return data as KnowledgeFileRecord;
};

export default function FileUploadKnowledge({
  files,
  onFilesChange,
  existingFiles = [],
  onDownloadExistingFile,
  onRemoveExistingFile,
}: FileUploadKnowledgeProps) {
  const [fileError, setFileError] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;

    const incomingFiles = Array.from(fileList);
    const validFiles = incomingFiles.filter((file) =>
      ALLOWED_KNOWLEDGE_FILE_EXTENSIONS.has(getFileExtension(file.name))
    );

    if (validFiles.length !== incomingFiles.length) {
      setFileError("Only PDF, Word, CSV, ZIP, and HTML files are allowed.");
    } else {
      setFileError("");
    }

    if (validFiles.length === 0) return;

    const existingKeys = new Set(
      files.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
    );
    const uniqueFiles = validFiles.filter(
      (file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`)
    );

    onFilesChange([...files, ...uniqueFiles]);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, idx) => idx !== index));
    setFileError("");
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={KNOWLEDGE_FILE_ACCEPT}
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
        className="hidden"
      />
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) {
            setIsDragActive(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragActive(false);
          addFiles(event.dataTransfer.files);
        }}
        className={`mt-3 rounded-2xl border border-dashed p-4 transition ${
          isDragActive
            ? "border-indigo-400 bg-indigo-50/80 shadow-[0_16px_30px_-24px_rgba(79,70,229,0.55)]"
            : "border-indigo-200 bg-white"
        }`}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-[132px] w-full flex-col items-center justify-center rounded-xl bg-[linear-gradient(135deg,#eef2ff_0%,#f8fbff_100%)] px-4 py-6 text-center transition hover:bg-indigo-50"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-[0_14px_28px_-20px_rgba(79,70,229,0.65)] ring-1 ring-indigo-100">
            <Plus size={24} />
          </span>
          <span className="mt-3 text-sm font-semibold text-gray-800">
            Upload or drag and drop files
          </span>
          <span className="mt-1 text-xs text-gray-400">
            PDF, Word, CSV, ZIP, or HTML
          </span>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-700">
            <Paperclip size={14} />
            Browse files
          </span>
        </button>

        {fileError ? (
          <p className="mt-2 text-xs font-medium text-red-600">{fileError}</p>
        ) : null}

        {existingFiles.length > 0 || files.length > 0 ? (
          <div className="mt-3 space-y-2">
            {existingFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-indigo-50"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {file.filename}
                    </p>
                    <p className="text-xs text-gray-400">
                      {file.content_type || "File"} | {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {onDownloadExistingFile ? (
                    <button
                      type="button"
                      onClick={() => onDownloadExistingFile(file)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100"
                      aria-label={`Download ${file.filename}`}
                    >
                      <Download size={14} />
                    </button>
                  ) : null}
                  {onRemoveExistingFile ? (
                    <button
                      type="button"
                      onClick={() => onRemoveExistingFile(file)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
                      aria-label={`Remove ${file.filename}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {files.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-indigo-50"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {getFileExtension(file.name).toUpperCase()} |{" "}
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-400">No knowledge files attached.</p>
        )}
      </div>
    </>
  );
}
