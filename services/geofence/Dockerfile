# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/geofence .

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/geofence /geofence
EXPOSE 8083
ENTRYPOINT ["/geofence"]
