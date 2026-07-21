//package com.mcp.server.entity;
package com.mcp.server.entity;

import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(
    name = "tool",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"tool_name", "org_key", "connector_id"})
    }
)
public class Tool {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String orgKey;
    private String connectorId;
    private String toolName;
    private String method;
    private String connectorName;
    private Integer toolCount;
    private String baseUrl;
    private String specUrl;
    private String description;
    private String tenantId;
    // 🔥 FIXED RELATION
    @OneToMany(mappedBy = "tool", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ToolParameter> parameters;

    public Long getId() {
        return id;
    }

    public String getToolName() {
        return toolName;
    }

    public void setToolName(String toolName) {
        this.toolName = toolName;
    }

    public String getOrgKey() {
        return orgKey;
    }

    public void setOrgKey(String orgKey) {
        this.orgKey = orgKey;
    }

    public String getConnectorId() {
        return connectorId;
    }

    public void setConnectorId(String connectorId) {
        this.connectorId = connectorId;
    }

    public String getMethod() {
        return method;
    }

    public void setMethod(String method) {
        this.method = method;
    }
   public String getConnectorName() {
        return connectorName;
    }
    public void setConnectorName(String connectorName) {
        this.connectorName = connectorName;
    }
    public Integer getToolCount() {
        return toolCount;
    }
    public void setToolCount(Integer toolCount) {
        this.toolCount = toolCount;
    }
    public List<ToolParameter> getParameters() {
        return parameters;
    }
   
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getSpecUrl() { return specUrl; }
    public void setSpecUrl(String specUrl) { this.specUrl = specUrl; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    // 🔥 IMPORTANT FIX
    public void setParameters(List<ToolParameter> parameters) {
        this.parameters = parameters;

        if (parameters != null) {
            for (ToolParameter p : parameters) {
                p.setTool(this); // 🔥 REQUIRED
                System.out.println("Tool Name Length = " + this.getToolName().length());
                System.out.println("Description Length = " + this.getDescription().length());
                System.out.println("Spec URL Length = " + this.getSpecUrl().length());
                System.out.println("Base URL Length = " + this.getBaseUrl().length());
            }
        }
    }
}

//
//import jakarta.persistence.*;
//import java.util.List;
//
//@Entity
//@Table(
//	    name = "tool",
//	    uniqueConstraints = {
//	        @UniqueConstraint(columnNames = {"tool_name", "org_key", "connector_id"})
//	    }
//	)
//public class Tool {
//
//	@Id
//	@GeneratedValue(strategy = GenerationType.IDENTITY)
//	private Long id;
//	private String orgKey;
//	private String connectorId;
//	private String toolName;
//	private String method;
//	private String endpoint;
//
//	@OneToMany(cascade = CascadeType.ALL)
//	private List<ToolParameter> parameters;
//
//	public Long getId() {
//		return id;
//	}
//
//	public String getToolName() {
//		return toolName;
//	}
//
//	public void setToolName(String toolName) {
//		this.toolName = toolName;
//	}
//
//	public String getOrgKey() {
//		return orgKey;
//	}
//
//	public void setOrgKey(String orgKey) {
//		this.orgKey = orgKey;
//	}
//
//	public String getConnectorId() {
//		return connectorId;
//	}
//
//	public void setConnectorId(String connectorId) {
//		this.connectorId = connectorId;
//	}
//
//	public String getMethod() {
//		return method;
//	}
//
//	public void setMethod(String method) {
//		this.method = method;
//	}
//
//	public String getEndpoint() {
//		return endpoint;
//	}
//
//	public void setEndpoint(String endpoint) {
//		this.endpoint = endpoint;
//	}
//
//	public List<ToolParameter> getParameters() {
//		return parameters;
//	}
//
//	public void setParameters(List<ToolParameter> parameters) {
//		this.parameters = parameters;
//	}
//}
