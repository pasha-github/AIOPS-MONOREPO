package com.mcp.server.repository;

import com.mcp.server.entity.Tool;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ToolRepository extends JpaRepository<Tool, Long> {
	
	 Optional<Tool> findByToolName(String name);
	 
	// List<Tool> findByOrgKeyAndConnectorId(String orgKey, String connectorId);
	 List<Tool> findByToolNameAndOrgKeyAndConnectorId(String toolName,String orgKey,String connectorId);
	 
	 
	 
	 List<Tool> findByOrgKey(String orgKey);
	 List<Tool> findByConnectorId(String connectorId);
	 List<Tool> findByConnectorIdAndOrgKey(String connectorId, String orgKey);
	 
	 @Query("SELECT t FROM Tool t LEFT JOIN FETCH t.parameters WHERE t.orgKey = :orgKey AND t.connectorId = :connectorId")
	 List<Tool> findByOrgKeyAndConnectorId(@Param("orgKey") String orgKey, @Param("connectorId") String connectorId);
	 
	 @Query("SELECT t FROM Tool t LEFT JOIN FETCH t.parameters WHERE t.orgKey = :orgKey AND t.connectorId = :connectorId")
	 List<Tool> findByOrgKeyAndConnectorIdWithParameters(@Param("orgKey") String orgKey,
	                                                     @Param("connectorId") String connectorId);
	 
	 
	 @Query("""
			    SELECT t FROM Tool t
			    LEFT JOIN FETCH t.parameters
			    WHERE t.toolName = :toolName
			    AND t.orgKey = :orgKey
			    AND t.connectorId = :connectorId
			""")
			List<Tool> findToolWithParameters(
			        String toolName,
			        String orgKey,
			        String connectorId);
}
