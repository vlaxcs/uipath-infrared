package workflow

import (
	"context"
	"net/http"
	"time"
)

const probeTimeout = time.Second

func answers(ctx context.Context, url string) bool {
	ctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return false
	}
	response.Body.Close()
	return true
}
