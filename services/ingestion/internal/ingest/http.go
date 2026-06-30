package ingest

import (
	"encoding/json"
	"net/http"
)

// Ingestion_Service interface): accepted, validation-error, or stale-ping.
type pingResponse struct {
	Accepted bool     `json:"accepted"`
	PingID   string   `json:"pingId,omitempty"`
	Error    string   `json:"error,omitempty"`
	Fields   []string `json:"fields,omitempty"`
}

// Handler returns an http.Handler for POST /v1/pings backed by the service.
func Handler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.Header().Set("Allow", http.MethodPost)
			writeJSON(w, http.StatusMethodNotAllowed, pingResponse{
				Accepted: false, Error: "method-not-allowed",
			})
			return
		}

		var req PingRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, pingResponse{
				Accepted: false, Error: "validation-error", Fields: []string{"body"},
			})
			return
		}

		res, err := svc.Ingest(r.Context(), req)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, pingResponse{
				Accepted: false, Error: "internal-error",
			})
			return
		}

		switch res.Status {
		case Accepted:
			writeJSON(w, http.StatusOK, pingResponse{Accepted: true, PingID: res.PingID})
		case Invalid:
			writeJSON(w, http.StatusBadRequest, pingResponse{
				Accepted: false, Error: "validation-error", Fields: res.Fields,
			})
		case Stale:
			writeJSON(w, http.StatusConflict, pingResponse{
				Accepted: false, Error: "stale-ping",
			})
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, body pingResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
