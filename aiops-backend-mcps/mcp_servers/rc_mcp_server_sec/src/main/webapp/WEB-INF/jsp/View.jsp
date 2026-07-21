<%@ page contentType="text/html;charset=UTF-8" %>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>MCP Management</title>

<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

<style>
body{
    background:#f5f7fb;
    font-family:Inter,sans-serif;
    padding:30px;
}

.registry-card{
    background:#ffffff;
    border-radius:16px;
    padding:25px;
    box-shadow:0 2px 10px rgba(0,0,0,.08);
}

.registry-header{
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin-bottom:25px;
}

.registry-title{
    font-size:28px;
    font-weight:600;
}

.btn-upload{
    background:#4f46e5;
    color:white;
    border:none;
    border-radius:10px;
    padding:10px 20px;
    font-weight:600;
}

.btn-upload:hover{
    background:#4338ca;
}

.registry-table{
    width:100%;
    border-collapse:collapse;
}

.registry-table thead{
    background:#eef2ff;
}

.registry-table th{
    padding:16px;
    font-weight:600;
    color:#374151;
    text-align:left;
}

.registry-table td{
    padding:20px 16px;
    border-top:1px solid #e5e7eb;
    vertical-align:middle;
}

.modal-dialog{
    max-width:600px;
}

.modal-content{
    border:none;
    border-radius:12px;
    overflow:hidden;
}

.modal-header{
    background:#4f46e5;
    color:white;
    padding:10px 15px;
}

.modal-title{
    font-size:16px;
    font-weight:600;
}

.modal-body{
    padding:12px 15px;
    max-height:60vh;
    overflow-y:auto;
}

.modal-footer{
    padding:8px 15px;
}

.form-label{
    font-size:13px;
    font-weight:600;
    margin-bottom:2px;
}

.form-control{
    height:34px;
    border-radius:6px;
    font-size:13px;
    padding:4px 8px;
}

.btn-primary{
    background:#4f46e5;
    border:none;
    font-size:14px;
    padding:6px 16px;
}

.btn-primary:hover{
    background:#4338ca;
}

.btn-secondary{
    font-size:14px;
    padding:6px 16px;
}

.row-gap{
    margin-bottom:8px;
}

.method-badge{
    display:inline-block;
    font-size:10px;
    font-weight:700;
    padding:2px 8px;
    border-radius:6px;
    margin-right:6px;
    color:#fff;
}
.method-GET{ background:#16a34a; }
.method-POST{ background:#2563eb; }
.method-PUT{ background:#d97706; }
.method-DELETE{ background:#dc2626; }
.method-PATCH{ background:#7c3aed; }

.tool-card{
    border:1px solid #e5e7eb;
    border-radius:8px;
    padding:8px 12px;
    cursor:pointer;
    background:#f9fafb;
    transition:background .15s;
}
.tool-card:hover{
    background:#eef2ff;
}

/* Pill/chip style tool badges (MCP Management view) */
.tool-pill{
    display:inline-block;
    background:#d1fae5;
    color:#065f46;
    font-size:13px;
    font-weight:600;
    padding:6px 16px;
    border-radius:999px;
    cursor:pointer;
    border:none;
    transition:background .15s;
}
.tool-pill:hover{
    background:#a7f3d0;
}
.tools-pill-wrapper{
    display:flex;
    flex-wrap:wrap;
    gap:10px;
}

.param-row{
    border-bottom:1px solid #eee;
    padding:8px 0;
}
.param-name{
    font-weight:600;
    font-size:13px;
}
.param-meta{
    font-size:11px;
    color:#6b7280;
}
.param-desc{
    font-size:12px;
    color:#374151;
    margin-top:2px;
}
</style>
</head>

<!-- Tool Parameters Modal -->
<div class="modal fade" id="toolsModal" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="toolsModalTitle">Tool Details</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="toolsModalBody" style="min-height:80px;">
                <p style="color:#666;">Loading...</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<body>

<div class="container-fluid">
    <div class="registry-card">
        <div class="registry-header">
            <div class="registry-title">
                MCP Management
            </div>
            <button class="btn-upload" data-bs-toggle="modal" data-bs-target="#createMcpModal">
                Create MCP
            </button>
        </div>

        <table class="min-w-full divide-y divide-gray-200 shadow-sm border border-gray-100 rounded-lg overflow-hidden registry-table">
            <thead class="bg-slate-100">
                <tr>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider w-12" style="text-align: center;">View</th>
                    <th class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Connector Name / ID</th>
                    <th class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">MCP URL</th>
                    <th class="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider w-32" style="text-align: center;">Tools Count</th>
                    <th class="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider w-24" style="text-align: center;">Action</th>
                </tr>
            </thead>
            <tbody id="mcpTableBody" class="bg-white divide-y divide-gray-200">
                <tr>
                    <td colspan="5" class="text-center py-6 text-gray-400 font-medium">
                        Loading records...
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<div class="modal fade" id="createMcpModal" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Create MCP</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>

            <form id="mcpForm" onsubmit="saveMcpConfigurationForm(event)">
                <div class="modal-body">
                    <div class="row row-gap">
                        <div class="col-12">
                            <label class="form-label">Spec URL</label>
                            <input type="text" class="form-control" name="specUrlInput" id="specUrlInput" onblur="fetchBaseUrlFromSpec()" required>
                        </div>
                    </div>

                    <div class="row row-gap">
                        <div class="col-12">
                            <label class="form-label">Base URL</label>
                            <input type="text" class="form-control" name="baseUrlInput" id="baseUrlInput" required>
                        </div>
                    </div>

                    <div class="row row-gap">
                        <div class="col-md-6">
                            <label class="form-label">Tenant ID</label>
                            <input type="text" class="form-control" name="tenantIdInput" id="tenantIdInput" value="Tenant_001" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Connector Name</label>
                            <input type="text" class="form-control" name="connectorNameInput" id="connectorNameInput" required>
                        </div>
                    </div>

                    <div class="row row-gap">
                        <div class="col-12">
                            <label class="form-label">Connector ID</label>
                            <input type="text" class="form-control" name="connectorIdInput" id="connectorIdInput" required>
                        </div>
                    </div>

                    <div class="row row-gap">
                        <div class="col-12">
                            <label class="form-label">Description</label>
                            <textarea class="form-control" name="descriptionInput" id="descriptionInput" rows="2" style="height:auto;"></textarea>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="submit" class="btn btn-primary">Save MCP</button>
                </div>
            </form>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

<script>
document.addEventListener("DOMContentLoaded", function() {
    loadDashboardGridListItems();
});

function closeModalWindowPopup() {
    var modalElement = document.getElementById('createMcpModal');
    var modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) {
        modalInstance.hide();
    }
    document.getElementById("mcpForm").reset();
}

function saveMcpConfigurationForm(event) {
    event.preventDefault();

    var specUrl       = document.getElementById('specUrlInput').value.trim();
    var baseUrl        = document.getElementById('baseUrlInput').value.trim();
    var tenantId       = document.getElementById('tenantIdInput').value.trim();
    var connectorName  = document.getElementById('connectorNameInput').value.trim();
    var connectorId    = document.getElementById('connectorIdInput').value.trim();
    var description    = document.getElementById('descriptionInput').value.trim();

    function isValidUrl(url) {
        return url.startsWith('http://') || url.startsWith('https://');
    }

    if (!specUrl) { alert("Spec URL is required."); return; }
    if (!isValidUrl(specUrl)) { alert("Spec URL must start with http:// or https://"); return; }
    if (!baseUrl) { alert("Base URL is required."); return; }
    if (!isValidUrl(baseUrl)) { alert("Base URL must start with http:// or https://"); return; }
    if (!tenantId) { alert("Tenant ID is required."); return; }
    if (!connectorName) { alert("Connector Name is required."); return; }
    if (!connectorId) { alert("Connector ID is required."); return; }

    var payloadData = {
        tenantId: tenantId,
        connectorId: connectorId,
        connectorName: connectorName,
        baseUrl: baseUrl,
        specUrl: specUrl,
        description: description
    };

    fetch('/api/mcp/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadData)
    })
    .then(function(response) {
        return response.json().then(function(result) {
            var isError = !response.ok
                       || result.status === "error"
                       || (result.message && result.message.toLowerCase().indexOf("error") !== -1)
                       || (result.message && result.message.toLowerCase().indexOf("exception") !== -1);

            if (isError) {
                alert("Something went wrong. Please check the URL and try again.");
                throw new Error(result.message);
            }
            return result;
        });
    })
    .then(function(data) {
        alert("Success: " + (data.message || "Saved Successfully"));
        closeModalWindowPopup();
        loadDashboardGridListItems();
    })
    .catch(function(err) {
        console.error("Save error:", err);
    });
}

function loadDashboardGridListItems() {
    fetch('/api/mcp/list')
        .then(function(response) { return response.json(); })
        .then(function(data) {
            renderTableGridItems(data);
        })
        .catch(function(error) {
            console.error("Error loading dashboard data:", error);
            document.getElementById("mcpTableBody").innerHTML =
                '<tr><td colspan="5" class="text-center text-danger py-4 font-semibold">Error fetching data from API server.</td></tr>';
        });
}

function renderTableGridItems(mcpDataList) {
    var tbody = document.getElementById('mcpTableBody');
    tbody.innerHTML = '';

    if (!mcpDataList || mcpDataList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-gray-400 font-medium">No records found</td></tr>';
        return;
    }

    mcpDataList.forEach(function(item, index) {
        var childRowId       = 'child_accordion_' + index;
        var toolsContainerId = 'tools_list_container_' + index;
        var connectorId      = item.connectorId || '';
        var connectorName    = item.connectorName || '';
        var mcpUrl           = item.url || 'N/A';
        var toolsCount       = item.toolsCount || 0;

        var mainRow = document.createElement('tr');
        mainRow.className = 'hover:bg-slate-50/80 transition-all duration-150';
        mainRow.innerHTML =
            '<td class="px-4 py-4 text-center">' +
                '<button id="btn_' + index + '"' +
                        ' onclick="toggleAccordion(\'' + childRowId + '\', \'' + toolsContainerId + '\', \'' + connectorId + '\', ' + index + ')"' +
                        ' class="font-bold text-xl text-blue-600 w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors">+</button>' +
            '</td>' +
            '<td class="px-6 py-4">' +
                '<div class="text-sm font-semibold text-gray-800">' + connectorName + '</div>' +
                '<div class="text-xs font-mono text-gray-500">' + connectorId + '</div>' +
            '</td>' +
            '<td class="px-6 py-4 text-sm font-mono text-blue-500/90">' +
                '<a href="' + mcpUrl + '" target="_blank">' + mcpUrl + '</a>' +
            '</td>' +
            '<td class="px-6 py-4 text-center text-slate-700 font-bold">' + toolsCount + '</td>' +
            '<td class="px-6 py-4 text-center">' +
                '<button onclick="deleteMcpRecordRow(\'' + connectorId + '\')" class="bg-red-500 text-white px-3 py-1 rounded text-xs">Delete</button>' +
            '</td>';

        var childRow = document.createElement('tr');
        childRow.id = childRowId;
        childRow.className = 'hidden bg-slate-50/50';
        childRow.innerHTML =
            '<td colspan="5" class="px-12 py-3">' +
                '<div id="' + toolsContainerId + '" class="flex flex-col gap-2"></div>' +
            '</td>';

        tbody.appendChild(mainRow);
        tbody.appendChild(childRow);
    });
}

function toggleAccordion(panelId, containerId, connectorId, index) {
    var panel     = document.getElementById(panelId);
    var container = document.getElementById(containerId);
    var btn       = document.getElementById('btn_' + index);

    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        btn.innerText = '−';
        container.innerHTML = '<p class="text-xs text-gray-500">Loading tools for ' + connectorId + '...</p>';

        // Full tool details (method, endpoint) fetch pannurom, pill style ah render pannurom
		fetch('/api/mcp/toolDetails/' + connectorId)
		    .then(function(res) { return res.json(); })
		    .then(function(tools) {
		        container.innerHTML = '';
		        if (tools && tools.length > 0) {
		            var wrapper = document.createElement('div');
		            wrapper.className = 'tools-pill-wrapper';

		            tools.forEach(function(tool) {
		                // tool_name comma separated ah irukum ("cloudhub,cloudhub2,hybrid"),
		                // adha split panni ovvoru name ku separate pill create pannurom
		                var names = (tool.toolName || '').split(',');

		                names.forEach(function(singleName) {
		                    var trimmedName = singleName.trim();
		                    if (trimmedName === '') return;

		                    var pill = document.createElement('span');
		                    pill.className = 'tool-pill';
		                    pill.innerText = trimmedName;
		                    pill.onclick = function() {
		                        // parameters modal ku individual tool name pass pannurom
		                        showToolParameters({ toolName: trimmedName, parameters: tool.parameters });
		                    };
		                    wrapper.appendChild(pill);
		                });
		            });

		            container.appendChild(wrapper);
		        } else {
		            container.innerHTML = "<p class='text-xs text-red-500'>No tools found.</p>";
		        }
		    })
            .catch(function(err) {
                container.innerHTML = "<p class='text-xs text-red-500'>Error loading tools.</p>";
                console.error(err);
            });
    } else {
        panel.classList.add('hidden');
        btn.innerText = '+';
    }
}

function showToolParameters(tool) {
    document.getElementById('toolsModalTitle').innerText = tool.toolName + ' — Parameters';
    var body = document.getElementById('toolsModalBody');

    var params = tool.parameters || [];
    if (params.length === 0) {
        body.innerHTML = '<p class="text-sm text-gray-500">No parameters found for this tool.</p>';
    } else {
        var html = '';
        params.forEach(function(p) {
            html +=
                '<div class="param-row">' +
                    '<div class="param-name">' + (p.name || '') +
                        (p.required ? ' <span class="text-danger">*</span>' : '') +
                    '</div>' +
                    '<div class="param-meta">' + (p.type || '') + ' &middot; ' + (p.paramIn || '') + '</div>' +
                    (p.description ? '<div class="param-desc">' + p.description + '</div>' : '') +
                    (p.example ? '<div class="param-meta">Example: ' + p.example + '</div>' : '') +
                '</div>';
        });
        body.innerHTML = html;
    }

    var modal = new bootstrap.Modal(document.getElementById('toolsModal'));
    modal.show();
}

function deleteMcpRecordRow(connectorId) {
    if (confirm("Are you sure you want to delete?")) {
        fetch('/api/mcp/delete/' + connectorId, {
            method: 'DELETE'
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.status === "success") {
                alert(data.message);
                loadDashboardGridListItems();
            } else {
                alert("Delete failed: " + data.message);
            }
        })
        .catch(function(error) {
            console.error("Error during deletion execution:", error);
            alert("Network error while clearing database row instance.");
        });
    }
}

function fetchBaseUrlFromSpec() {
    var specUrl      = document.getElementById('specUrlInput').value.trim();
    var baseUrlInput = document.getElementById('baseUrlInput');

    if (specUrl && !baseUrlInput.value) {
        baseUrlInput.value = "Fetching...";

        fetch('/api/mcp/extract-base-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ specUrl: specUrl })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.baseUrl) {
                baseUrlInput.value = data.baseUrl;
            } else {
                baseUrlInput.value = "";
                alert("Could not extract Base URL. Please enter manually.");
            }
        })
        .catch(function(err) {
            console.error("Error fetching base URL:", err);
            baseUrlInput.value = "";
        });
    }
}
</script>

</body>
</html>
