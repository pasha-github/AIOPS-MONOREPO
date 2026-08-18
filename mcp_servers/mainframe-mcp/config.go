package main

import (
	"fmt"
	"os"
)

// Config holds the connection settings for the target z/OSMF instance. Values
// are read from the environment so the same image can target any LPAR.
type Config struct {
	BaseURL  string // z/OSMF base URL, e.g. https://192.168.18.246:10443
	User     string // mainframe user id
	Password string // mainframe password
	System   string // z/OSMF system nickname, e.g. S0W1
	Owner    string // workflow owner / default notify user, e.g. ADCDMST

	// Workflow definition files on the mainframe (USS paths).
	InfoDefinitionFile       string // Workflow1 definition (b37_info_retrieve.xml)
	ReallocateDefinitionFile string // Workflow2 definition (b37_remed)

	// Default output data sets written by the workflows.
	InfoOutputDataset       string // Workflow1 output (ADCDMST.DSINFO.OUT)
	ReallocateOutputDataset string // Workflow2 output (ADCDMST.B37.WFOUT)
}

// getenv returns the env var value or a fallback default.
func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// LoadConfig reads configuration from the environment. Only MAINFRAME_BASE_URL
// is strictly required; the rest have sensible defaults matching the reference
// LPAR but can be overridden.
func LoadConfig() (*Config, error) {
	cfg := &Config{
		BaseURL:  os.Getenv("MAINFRAME_BASE_URL"),
		User:     getenv("MAINFRAME_USER", "ADCDMST"),
		Password: getenv("MAINFRAME_PASSWORD", "RC2027"),
		System:   getenv("MAINFRAME_SYSTEM", "S0W1"),
		Owner:    getenv("MAINFRAME_OWNER", "ADCDMST"),

		InfoDefinitionFile:       getenv("MAINFRAME_INFO_DEF_FILE", "/u/adcdmst/workflows/b37_info_retrieve.xml"),
		ReallocateDefinitionFile: getenv("MAINFRAME_REALLOC_DEF_FILE", "/u/adcdmst/workflows/b37_remed"),

		InfoOutputDataset:       getenv("MAINFRAME_INFO_OUTPUT_DS", "ADCDMST.DSINFO.OUT"),
		ReallocateOutputDataset: getenv("MAINFRAME_REALLOC_OUTPUT_DS", "ADCDMST.B37.WFOUT"),
	}

	if cfg.BaseURL == "" {
		return nil, fmt.Errorf("MAINFRAME_BASE_URL environment variable is required (e.g. https://192.168.18.246:10443)")
	}
	return cfg, nil
}
