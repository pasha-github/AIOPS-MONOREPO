package com.mcp.server.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.mcp.server.entity.ToolList;

@Repository
public interface ToolListRepository extends JpaRepository<ToolList, String> {
    Optional<ToolList> findByTenantIdAndConnectorId(String tenantId, String connectorId);
}