"use client";

import SkillModal from "./skillsoverview/SkillModal";

type UpdateSkillProps = {
  skillId: string | null;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
};

export default function UpdateSkill({
  skillId,
  onClose,
  onUpdated,
}: UpdateSkillProps) {
  return (
    <SkillModal
      isOpen={Boolean(skillId)}
      mode="update"
      skillId={skillId}
      onClose={onClose}
      onSaved={onUpdated}
    />
  );
}
