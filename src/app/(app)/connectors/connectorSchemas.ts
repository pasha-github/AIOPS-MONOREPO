export type ConfigField = {
  name: string;
  label: string;
  required: boolean;
  secret?: boolean;
  placeholder?: string;
};

export const CONNECTOR_CONFIG_SCHEMAS: Record<string, ConfigField[]> = {
  datadog_connector: [
    {
      name: "DD_API_KEY",
      label: "DD API Key",
      required: true,
      secret: true,
      placeholder: "Enter DD API key",
    },
    {
      name: "DD_APP_KEY",
      label: "DD App Key",
      required: true,
      secret: true,
      placeholder: "Enter DD App key",
    },
    {
      name: "DD_SITE",
      label: "DD Site",
      required: false,
      placeholder: "https://api.us5.datadoghq.com",
    },
    {
      name: "prefix",
      label: "Prefix",
      required: false,
      placeholder: "Enter prefix",
    },
  ],
  servicenow_connector: [
    {
      name: "SERVICENOW_INSTANCE_URL",
      label: "ServiceNow Instance URL",
      required: true,
      placeholder: "Enter instance URL",
    },
    {
      name: "SERVICENOW_USERNAME",
      label: "ServiceNow Username",
      required: true,
      placeholder: "Enter username",
    },
    {
      name: "SERVICENOW_PASSWORD",
      label: "ServiceNow Password",
      required: true,
      secret: true,
      placeholder: "Enter password",
    },
    {
      name: "SERVICENOW_AUTH_TYPE",
      label: "ServiceNow Auth Type",
      required: false,
      placeholder: "Enter auth type",
    },
    {
      name: "prefix",
      label: "Prefix",
      required: false,
      placeholder: "Servicenow",
    },
  ],
  ibm_mq_connector: [
  {
    name: "URL_BASE",
    label: "URL Base",
    required: true,
    placeholder: "Enter base URL",
  },
  {
    name: "USER_NAME",
    label: "User Name",
    required: true,
    placeholder: "Enter username",
  },
  {
    name: "PASSWORD",
    label: "Password",
    required: true,
    secret: true,
    placeholder: "Enter password",
  },
  {
    name: "LOGS_URL",
    label: "Logs URL",
    required: true,
    placeholder: "Enter logs URL",
  },
  {
    name: "SSH_HOSTNAME",
    label: "SSH Hostname",
    required: true,
    placeholder: "Enter SSH hostname",
  },
  {
    name: "SSH_USERNAME",
    label: "SSH Username",
    required: true,
    placeholder: "Enter SSH username",
  },
  {
    name: "SSH_PASSWORD",
    label: "SSH Password",
    required: true,
    secret: true,
    placeholder: "Enter SSH password",
  },
  {
    name: "VERIFY_TLS",
    label: "Verify TLS",
    required: false,
    placeholder: "true or false",
  },
  {
    name: "prefix",
    label: "Prefix",
    required: false,
    placeholder: "IBM MQ",
  },
],
  teams_connector: [
    {
      name: "TEAMS_BOT_BASE_URL",
      label: "Teams Bot Base URL",
      required: true,
      placeholder: "Enter Teams bot base URL",
    },
    {
      name: "ALERT_API_KEY",
      label: "Alert API Key",
      required: true,
      secret: true,
      placeholder: "Enter alert API key",
    },
    {
      name: "EMAILS",
      label: "Emails",
      required: false,
      placeholder: "Enter email addresses",
    },
    {
      name: "CONVERSATION_IDS",
      label: "Conversation IDs",
      required: false,
      placeholder: "Enter conversation IDs",
    },
    {
      name: "prefix",
      label: "Prefix",
      required: false,
      placeholder: "Teams",
    },
  ],
};
