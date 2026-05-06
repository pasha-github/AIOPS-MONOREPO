export type ConfigField = {
  name: string;
  label: string;
  required: boolean;
  secret?: boolean;
  placeholder?: string;
};

export type ConnectorTool = {
  name: string;
  documentation: string;
};

export type ConnectorDetails = {
  documentation: string;
  tools: ConnectorTool[];
  config_variables: ConfigField[];
};

const connectorDetailsRequests = new Map<string, Promise<ConnectorDetails>>();

export async function fetchConnectorDetails(
  connectorId: string,
  connectorsApiBase: string
) {
  const cacheKey = `${connectorsApiBase}::${connectorId}`;
  const existingRequest = connectorDetailsRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetch(
    `${connectorsApiBase}/connectors/${encodeURIComponent(connectorId)}`,
    {
      method: "GET",
      headers: { accept: "application/json" },
    }
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Unable to load connector details.");
      }

      return (await response.json()) as ConnectorDetails;
    })
    .finally(() => {
      connectorDetailsRequests.delete(cacheKey);
    });

  connectorDetailsRequests.set(cacheKey, request);
  return request;
}

export async function fetchConnectorSchema(
  connectorId: string,
  connectorsApiBase: string
) {
  const details = await fetchConnectorDetails(connectorId, connectorsApiBase);
  return Array.isArray(details.config_variables) ? details.config_variables : [];
}
