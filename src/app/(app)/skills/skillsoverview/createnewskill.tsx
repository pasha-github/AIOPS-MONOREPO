"use client";

import SkillModal from "./SkillModal";

type CreateNewSkillProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CreateNewSkill({ isOpen, onClose }: CreateNewSkillProps) {
  return <SkillModal isOpen={isOpen} mode="create" onClose={onClose} />;
}
