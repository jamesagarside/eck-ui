// Package errors provides error handling utilities for the ECK UI.
package errors

import (
	"encoding/json"
	"errors"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// APIError represents an error response from the API.
type APIError struct {
	// Code is the HTTP status code.
	Code int `json:"code"`
	// Message is a human-readable error message.
	Message string `json:"message"`
	// Details provides additional error context.
	Details string `json:"details,omitempty"`
	// RequestID is the correlation ID for the request.
	RequestID string `json:"request_id,omitempty"`
}

// Error implements the error interface.
func (e *APIError) Error() string {
	return e.Message
}

// Common errors
var (
	ErrNotFound       = &APIError{Code: http.StatusNotFound, Message: "resource not found"}
	ErrUnauthorized   = &APIError{Code: http.StatusUnauthorized, Message: "unauthorized"}
	ErrForbidden      = &APIError{Code: http.StatusForbidden, Message: "forbidden"}
	ErrBadRequest     = &APIError{Code: http.StatusBadRequest, Message: "bad request"}
	ErrInternalServer = &APIError{Code: http.StatusInternalServerError, Message: "internal server error"}
	ErrConflict       = &APIError{Code: http.StatusConflict, Message: "resource already exists"}
)

// FromKubernetesError converts a Kubernetes API error to an APIError.
func FromKubernetesError(err error) *APIError {
	if err == nil {
		return nil
	}

	var statusErr *apierrors.StatusError
	if errors.As(err, &statusErr) {
		status := statusErr.Status()
		return &APIError{
			Code:    int(status.Code),
			Message: status.Message,
			Details: string(status.Reason),
		}
	}

	// Check for specific Kubernetes error types
	if apierrors.IsNotFound(err) {
		return &APIError{
			Code:    http.StatusNotFound,
			Message: "resource not found",
			Details: err.Error(),
		}
	}
	if apierrors.IsAlreadyExists(err) {
		return &APIError{
			Code:    http.StatusConflict,
			Message: "resource already exists",
			Details: err.Error(),
		}
	}
	if apierrors.IsUnauthorized(err) {
		return &APIError{
			Code:    http.StatusUnauthorized,
			Message: "unauthorized",
			Details: err.Error(),
		}
	}
	if apierrors.IsForbidden(err) {
		return &APIError{
			Code:    http.StatusForbidden,
			Message: "forbidden",
			Details: err.Error(),
		}
	}
	if apierrors.IsInvalid(err) {
		return &APIError{
			Code:    http.StatusBadRequest,
			Message: "invalid resource",
			Details: err.Error(),
		}
	}
	if apierrors.IsConflict(err) {
		return &APIError{
			Code:    http.StatusConflict,
			Message: "conflict - resource was modified",
			Details: err.Error(),
		}
	}
	if apierrors.IsServiceUnavailable(err) {
		return &APIError{
			Code:    http.StatusServiceUnavailable,
			Message: "kubernetes API unavailable",
			Details: err.Error(),
		}
	}
	if apierrors.IsTimeout(err) {
		return &APIError{
			Code:    http.StatusGatewayTimeout,
			Message: "request timeout",
			Details: err.Error(),
		}
	}

	// Default to internal server error
	return &APIError{
		Code:    http.StatusInternalServerError,
		Message: "internal server error",
		Details: err.Error(),
	}
}

// WriteError writes an error response to the http.ResponseWriter.
func WriteError(w http.ResponseWriter, err error, requestID string) {
	var apiErr *APIError

	if errors.As(err, &apiErr) {
		apiErr.RequestID = requestID
	} else {
		// Try to convert from Kubernetes error
		apiErr = FromKubernetesError(err)
		if apiErr == nil {
			apiErr = &APIError{
				Code:      http.StatusInternalServerError,
				Message:   "internal server error",
				RequestID: requestID,
			}
		}
		apiErr.RequestID = requestID
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(apiErr.Code)
	_ = json.NewEncoder(w).Encode(apiErr)
}

// WriteJSON writes a JSON response to the http.ResponseWriter.
func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// BadRequest creates a bad request error with the given message.
func BadRequest(message string) *APIError {
	return &APIError{
		Code:    http.StatusBadRequest,
		Message: message,
	}
}

// NotFound creates a not found error with the given message.
func NotFound(message string) *APIError {
	return &APIError{
		Code:    http.StatusNotFound,
		Message: message,
	}
}

// Forbidden creates a forbidden error with the given message.
func Forbidden(message string) *APIError {
	return &APIError{
		Code:    http.StatusForbidden,
		Message: message,
	}
}

// InternalServer creates an internal server error with the given message.
func InternalServer(message string) *APIError {
	return &APIError{
		Code:    http.StatusInternalServerError,
		Message: message,
	}
}
