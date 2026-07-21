"use client";

import AddKnowledge from "./addknowledge";

type KnowledgeSourcesProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
};

export default function KnowledgeSources({ files, onFilesChange }: KnowledgeSourcesProps) {
  return <AddKnowledge files={files} onFilesChange={onFilesChange} />;
}
