
package com.mcp.server.entity;

import jakarta.persistence.*;

@Entity
public class ToolParameter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String type;
    private boolean required;

    private String paramIn; // body, query, path
    private String description;
    private String example;

	// 🔥 FIXED RELATION
    @ManyToOne
    @JoinColumn(name = "tool_id")
    private Tool tool;

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public boolean isRequired() {
        return required;
    }

    public void setRequired(boolean required) {
        this.required = required;
    }

    public String getParamIn() {
        return paramIn;
    }

    public void setParamIn(String paramIn) {
        this.paramIn = paramIn;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getExample() {
        return example;
    }

    public void setExample(String example) {
        this.example = example;
    }

    // 🔥 REQUIRED
    public Tool getTool() {
        return tool;
    }

    public void setTool(Tool tool) {
        this.tool = tool;
    }
}

//package com.mcp.server.entity;
//
//import jakarta.persistence.*;
//
//@Entity
//public class ToolParameter {
//
//	@Id
//	@GeneratedValue(strategy = GenerationType.IDENTITY)
//	private Long id;
//
//	private String name;
//	private String type;
//	private boolean required;
//
//	private String paramIn; // body, query, path
//	private String description;
//	private String example;
//
//	public String getName() {
//		return name;
//	}
//
//	public void setName(String name) {
//		this.name = name;
//	}
//
//	public String getType() {
//		return type;
//	}
//
//	public void setType(String type) {
//		this.type = type;
//	}
//
//	public boolean isRequired() {
//		return required;
//	}
//
//	public void setRequired(boolean required) {
//		this.required = required;
//	}
//
//	public Long getId() {
//		return id;
//	}
//
//	public void setId(Long id) {
//		this.id = id;
//	}
//
//	public String getParamIn() {
//		return paramIn;
//	}
//
//	public void setParamIn(String paramIn) {
//		this.paramIn = paramIn;
//	}
//
//	public String getDescription() {
//		return description;
//	}
//
//	public void setDescription(String description) {
//		this.description = description;
//	}
//
//	public String getExample() {
//		return example;
//	}
//
//	public void setExample(String example) {
//		this.example = example;
//	}
//
//}
