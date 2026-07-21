"use client";

import { ThemedSingleDropdown } from "./DynamicConnector";
import type { AwsCredentialOption } from "./awsCredentials";

type AwsCredentialDropdownProps = {
  value: string;
  options: AwsCredentialOption[];
  loading: boolean;
  error: string;
  onChange: (value: string) => void;
};

export default function AwsCredentialDropdown({
  value,
  options,
  loading,
  error,
  onChange,
}: AwsCredentialDropdownProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
        Credentials <span className="text-red-500">*</span>
      </label>
      <p className="text-xs leading-snug text-gray-400">
        Select AWS credentials for AWS AgentCore deployment
      </p>
      <ThemedSingleDropdown
        value={value}
        options={options}
        placeholder={
          loading
            ? "Loading AWS credentials..."
            : options.length === 0
              ? "No AWS credentials available"
              : "Select credentials"
        }
        onChange={onChange}
        disabled={loading || options.length === 0}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
