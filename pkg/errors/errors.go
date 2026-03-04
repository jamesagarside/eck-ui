package errors

import (
	"encoding/json"
	"fmt"
	"net/http"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
)

// APIError represents a structured error response returned to API clients.
type APIError struct {
	StatusCode int    `json:"statusCode"`
	Reason     string `json:"reason"`
	Message    string `json:"message"`
}

// Error implements the error interface.
func (e *APIError) Error() string {
	return fmt.Sprintf("%d %s: %s", e.StatusCode, e.Reason, e.Message)
}

// Common API errors.
var (
	ErrNotFound = &APIError{
		StatusCode: http.StatusNotFound,
		Reason:     "NotFound",
		Message:    "The requested resource was not found.",
	}

	ErrUnauthorized = &APIError{
		StatusCode: http.StatusUnauthorized,
		Reason:     "Unauthorized",
		Message:    "Authentication is required to access this resource.",
	}

	ErrForbidden = &APIError{
		StatusCode: http.StatusForbidden,
		Reason:     "Forbidden",
		Message:    "You do not have permission to perform this action.",
	}

	ErrConflict = &APIError{
		StatusCode: http.StatusConflict,
		Reason:     "Conflict",
		Message:    "The resource already exists or has been modified.",
	}

	ErrBadRequest = &APIError{
		StatusCode: http.StatusBadRequest,
		Reason:     "BadRequest",
		Message:    "The request body is invalid or malformed.",
	}

	ErrInternal = &APIError{
		StatusCode: http.StatusInternalServerError,
		Reason:     "InternalError",
		Message:    "An internal server error occurred.",
	}
)

// New creates a new APIError with the given status code, reason, and message.
func New(statusCode int, reason, message string) *APIError {
	return &APIError{
		StatusCode: statusCode,
		Reason:     reason,
		Message:    message,
	}
}

// WriteError writes a JSON-encoded error response to the http.ResponseWriter.
func WriteError(w http.ResponseWriter, err error) {
	apiErr, ok := err.(*APIError)
	if !ok {
		apiErr = &APIError{
			StatusCode: http.StatusInternalServerError,
			Reason:     "InternalError",
			Message:    err.Error(),
		}
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(apiErr.StatusCode)
	json.NewEncoder(w).Encode(apiErr)
}

// FromK8sError converts a Kubernetes API error into an APIError.
func FromK8sError(err error) *APIError {
	if err == nil {
		return nil
	}

	statusErr, ok := err.(*k8serrors.StatusError)
	if !ok {
		return &APIError{
			StatusCode: http.StatusInternalServerError,
			Reason:     "InternalError",
			Message:    err.Error(),
		}
	}

	status := statusErr.ErrStatus
	code := int(status.Code)
	if code == 0 {
		code = http.StatusInternalServerError
	}

	return &APIError{
		StatusCode: code,
		Reason:     string(status.Reason),
		Message:    status.Message,
	}
}
