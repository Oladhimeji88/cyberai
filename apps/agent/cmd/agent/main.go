package main

import (
	"log"
	"time"

	"github.com/democorp/sentinel-agent/internal/client"
	"github.com/democorp/sentinel-agent/internal/collector"
	"github.com/democorp/sentinel-agent/internal/config"
)

func main() {
	cfg := config.Load()
	sender, err := client.New(cfg)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("agent started for org=%s host=%s", cfg.OrgID, cfg.Hostname)
	for {
		events := collector.ProcessEvents(cfg.OrgID, cfg.Hostname)
		events = append(events, collector.NetEvents(cfg.OrgID, cfg.Hostname)...)
		for _, e := range events {
			if err := sender.Send(e); err != nil {
				log.Printf("send failed: %v", err)
			}
		}
		time.Sleep(30 * time.Second)
	}
}