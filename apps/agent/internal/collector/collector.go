package collector

import (
	"bufio"
	"os/exec"
	"strings"
	"time"
)

type Event struct {
	OrgID    string `json:"orgId"`
	Hostname string `json:"hostname"`
	Type     string `json:"type"`
	Process  string `json:"process,omitempty"`
	Port     int    `json:"port,omitempty"`
	Proto    string `json:"proto,omitempty"`
	TS       string `json:"ts"`
}

func ProcessEvents(orgID, host string) []Event {
	cmd := exec.Command("sh", "-c", "ps -eo comm=")
	out, err := cmd.Output()
	if err != nil {
		return nil
	}
	seen := map[string]bool{}
	list := strings.Split(string(out), "\n")
	var events []Event
	for _, p := range list {
		p = strings.TrimSpace(p)
		if p == "" || seen[p] {
			continue
		}
		seen[p] = true
		events = append(events, Event{OrgID: orgID, Hostname: host, Type: "process_start", Process: p, TS: time.Now().UTC().Format(time.RFC3339)})
	}
	return events
}

func NetEvents(orgID, host string) []Event {
	cmd := exec.Command("sh", "-c", "ss -tun")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil
	}
	if err := cmd.Start(); err != nil {
		return nil
	}
	var events []Event
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "Netid") || line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 5 {
			continue
		}
		addr := parts[4]
		chunks := strings.Split(addr, ":")
		if len(chunks) < 2 {
			continue
		}
		portRaw := chunks[len(chunks)-1]
		port := 0
		for _, c := range portRaw {
			if c < '0' || c > '9' {
				port = 0
				break
			}
			port = port*10 + int(c-'0')
		}
		if port == 0 {
			continue
		}
		events = append(events, Event{OrgID: orgID, Hostname: host, Type: "net_conn", Port: port, Proto: parts[0], TS: time.Now().UTC().Format(time.RFC3339)})
	}
	_ = cmd.Wait()
	return events
}