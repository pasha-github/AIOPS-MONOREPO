package com.mcp.server.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "tool_list")
public class ToolList {

    @Id
    @Column(name = "connector_id")
    @JsonProperty("connectorId")
    private String connectorId;

    @Column(name = "tenant_id")
    @JsonProperty("tenantId") 
    private String tenantId;

    @Column(name = "connector_name")
    @JsonProperty("connectorName")
    private String connectorName;

    @Column(name = "base_url")
    @JsonProperty("baseUrl")
    private String baseUrl;

    @Column(name = "spec_url")
    @JsonProperty("specUrl") // 🎯 Jackson serialization name clash aagama irukka 'specUrl' nu mathiyacha
    private String specUrl;

    @Column(name = "description", columnDefinition = "TEXT")
    @JsonProperty("description")
    private String description;

    @Column(name = "tools_count")
    @JsonProperty("toolsCount") // Frontend table dynamic parsing tracking structure helper key
    private Integer toolsCount = 0;
 // Tool.java entity-la
    @Column(name = "toolname", columnDefinition = "TEXT")
    private String toolname;

    // Getter and Setter
    public String getToolname() { return toolname; }
    public void setToolname(String toolname) { this.toolname = toolname; }
    @Transient
    @JsonProperty("url") // 🎯 Frontend template grid loop dynamic table block-ku exact redirection context mapping 'url' key 
    private String url;
    @Transient // DB table-la indha column irukaadhu, aana API response-la varum
    private List<String> toolNames;

    // Add Getters and Setters
    public List<String> getToolNames() { return toolNames; }
    public void setToolNames(List<String> toolNames) { this.toolNames = toolNames; }

    public ToolList() {}

    // Getters and Setters block maps da
    public String getConnectorId() { return connectorId; }
    public void setConnectorId(String connectorId) { this.connectorId = connectorId; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getConnectorName() { return connectorName; }
    public void setConnectorName(String connectorName) { this.connectorName = connectorName; }

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public String getSpecUrl() { return specUrl; }
    public void setSpecUrl(String specUrl) { this.specUrl = specUrl; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getToolsCount() { return toolsCount; }
    public void setToolsCount(Integer toolsCount) { this.toolsCount = toolsCount; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    
}