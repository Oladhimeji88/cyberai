package client

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/democorp/sentinel-agent/internal/config"
)

type Sender struct {
	cfg    config.Config
	client *http.Client
}

func New(cfg config.Config) (*Sender, error) {
	tr := &http.Transport{}
	if cfg.ClientCert != "" && cfg.ClientKey != "" && cfg.CACert != "" {
		cert, err := tls.LoadX509KeyPair(cfg.ClientCert, cfg.ClientKey)
		if err != nil {
			return nil, err
		}
		caData, err := os.ReadFile(cfg.CACert)
		if err != nil {
			return nil, err
		}
		pool := x509.NewCertPool()
		pool.AppendCertsFromPEM(caData)
		tr.TLSClientConfig = &tls.Config{Certificates: []tls.Certificate{cert}, RootCAs: pool, MinVersion: tls.VersionTLS12}
	}
	return &Sender{cfg: cfg, client: &http.Client{Timeout: 10 * time.Second, Transport: tr}}, nil
}

func (s *Sender) Send(event any) error {
	data, _ := json.Marshal(event)
	req, _ := http.NewRequest(http.MethodPost, s.cfg.BackendURL, bytes.NewBuffer(data))
	req.Header.Set("content-type", "application/json")
	req.Header.Set("x-agent-token", s.cfg.AgentToken)
	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}