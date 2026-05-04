"use client";

import SkillModal from "./skillsoverview/SkillModal";

type ViewSkillProps = {
  skillId: string | null;
  onClose: () => void;
};

export default function ViewSkill({ skillId, onClose }: ViewSkillProps) {
  return (
    <SkillModal
      isOpen={Boolean(skillId)}
      mode="view"
      skillId={skillId}
      onClose={onClose}
    />
  );
}
