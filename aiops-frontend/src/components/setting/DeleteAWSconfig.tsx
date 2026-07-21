"use client";

import DeleteConfigButton from "./DeleteConfigButton";

type DeleteAWSconfigProps = {
  baseUrl: string;
  credentialId: string;
  disabled?: boolean;
  iconOnly?: boolean;
  onDeleted: () => void;
  onErrorChange: (value: string) => void;
};

export default function DeleteAWSconfig({
  baseUrl,
  credentialId,
  disabled = false,
  iconOnly = false,
  onDeleted,
  onErrorChange,
}: DeleteAWSconfigProps) {
  return (
    <DeleteConfigButton
      baseUrl={baseUrl}
      requestPath={`/aws/credentials/${encodeURIComponent(credentialId)}`}
      fallbackErrorMessage="Unable to delete AWS credential."
      label="Delete credential"
      disabled={disabled}
      iconOnly={iconOnly}
      onDeleted={onDeleted}
      onErrorChange={onErrorChange}
    />
  );
}
