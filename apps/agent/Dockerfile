FROM golang:1.22-alpine AS build
WORKDIR /src
COPY apps/agent/go.mod ./go.mod
COPY apps/agent ./
RUN go build -o /out/agent ./cmd/agent

FROM alpine:3.20
COPY --from=build /out/agent /usr/local/bin/agent
CMD ["agent"]