package config

import "os"

type Config struct {
	BackendURL string
	OrgID      string
	AgentToken string
	ClientCert string
	ClientKey  string
	CACert     string
	Hostname   string
}

func Load() Config {
	host, _ := os.Hostname()
	return Config{
		BackendURL: getenv("AGENT_BACKEND_URL", "http://localhost:4000/cnapp/runtime/ingest"),
		OrgID:      getenv("AGENT_ORG_ID", "demo-org"),
		AgentToken: getenv("AGENT_TOKEN", "agent-demo-token"),
		ClientCert: os.Getenv("AGENT_CLIENT_CERT"),
		ClientKey:  os.Getenv("AGENT_CLIENT_KEY"),
		CACert:     os.Getenv("AGENT_CA_CERT"),
		Hostname:   host,
	}
}

func getenv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}