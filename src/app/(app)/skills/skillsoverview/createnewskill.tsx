"use client";

import SkillModal from "./SkillModal";

type CreateNewSkillProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => Promise<void> | void;
};

export default function CreateNewSkill({
  isOpen,
  onClose,
  onCreated,
}: CreateNewSkillProps) {
  return (
    <SkillModal
      isOpen={isOpen}
      mode="create"
      onClose={onClose}
      onSaved={onCreated}
    />
  );
}
