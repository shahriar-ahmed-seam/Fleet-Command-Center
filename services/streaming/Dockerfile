# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/streaming .

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/streaming /streaming
EXPOSE 8082
ENTRYPOINT ["/streaming"]
