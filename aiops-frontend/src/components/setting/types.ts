export type ProviderKey = "vertex" | "azure" | "aws";
export type ConfigTab = "set" | "view";

export type ProviderOption = {
  key: ProviderKey;
  label: string;
  logoKey?: string;
  available: boolean;
  disable: boolean;
};

export type VertexConfigView = {
  id: number;
  project_id: string;
  location: string;
  staging_bucket: string;
  has_google_application_credentials: boolean;
  created_at: string;
  updated_at: string;
};

export type VertexSetPayload = {
  project_id: string;
  location: string;
  staging_bucket: string;
  google_application_credentials: Record<string, unknown>;
};

export type AwsCredential = {
  credential_id: string;
  name: string;
  access_key_id: string;
  region: string;
  is_default: boolean;
  has_session_token: boolean;
  created_at: string;
  updated_at: string;
};

export type AwsSetPayload = {
  name: string;
  access_key_id: string;
  secret_access_key: string;
  session_token: string;
  region: string;
  is_default: boolean;
};
