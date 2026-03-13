package clusters

import (
	"log/slog"
	"sync"
	"time"
)

// CircuitState represents the state of a circuit breaker.
type CircuitState int

const (
	// StateClosed is the normal operating state — requests flow through.
	StateClosed CircuitState = iota
	// StateOpen blocks requests and serves stale data.
	StateOpen
	// StateHalfOpen allows a single probe request.
	StateHalfOpen
)

// String returns a human-readable circuit state name.
func (s CircuitState) String() string {
	switch s {
	case StateClosed:
		return "CLOSED"
	case StateOpen:
		return "OPEN"
	case StateHalfOpen:
		return "HALF-OPEN"
	default:
		return "UNKNOWN"
	}
}

// CircuitBreaker implements a per-cluster circuit breaker with three states:
// CLOSED (normal), OPEN (blocking), and HALF-OPEN (probe).
type CircuitBreaker struct {
	mu               sync.Mutex
	state            CircuitState
	failures         int
	failureThreshold int
	recoveryTimeout  time.Duration
	lastFailure      time.Time
	probeAllowed     bool
	clusterID        string
	onStateChange    func(clusterID string, from, to CircuitState)
}

// NewCircuitBreaker creates a circuit breaker for the given cluster with
// configurable thresholds.
func NewCircuitBreaker(clusterID string, failureThreshold int, recoveryTimeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		state:            StateClosed,
		failureThreshold: failureThreshold,
		recoveryTimeout:  recoveryTimeout,
		clusterID:        clusterID,
	}
}

// SetOnStateChange sets a callback invoked on state transitions.
func (cb *CircuitBreaker) SetOnStateChange(fn func(clusterID string, from, to CircuitState)) {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.onStateChange = fn
}

// State returns the current circuit state.
func (cb *CircuitBreaker) State() CircuitState {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.currentState()
}

// currentState returns the state, transitioning OPEN to HALF-OPEN if recovery timeout expired.
// Must be called with cb.mu held.
func (cb *CircuitBreaker) currentState() CircuitState {
	if cb.state == StateOpen && time.Since(cb.lastFailure) >= cb.recoveryTimeout {
		cb.transition(StateHalfOpen)
		cb.probeAllowed = true
	}
	return cb.state
}

// AllowRequest returns whether a request should be allowed and the current state.
// In HALF-OPEN state, only one probe request is allowed.
func (cb *CircuitBreaker) AllowRequest() (bool, CircuitState) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	state := cb.currentState()
	switch state {
	case StateClosed:
		return true, state
	case StateOpen:
		return false, state
	case StateHalfOpen:
		if cb.probeAllowed {
			cb.probeAllowed = false
			return true, state
		}
		return false, state
	default:
		return false, state
	}
}

// RecordSuccess records a successful request. Resets the failure counter and
// closes the circuit if it was half-open.
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures = 0
	if cb.state != StateClosed {
		cb.transition(StateClosed)
	}
}

// RecordFailure records a failed request. Increments the failure counter and
// opens the circuit when the threshold is reached.
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures++
	cb.lastFailure = time.Now()

	if cb.state == StateHalfOpen {
		// Probe failed — reopen.
		cb.transition(StateOpen)
		return
	}

	if cb.failures >= cb.failureThreshold && cb.state == StateClosed {
		cb.transition(StateOpen)
	}
}

// transition changes the circuit state and fires the callback.
// Must be called with cb.mu held.
func (cb *CircuitBreaker) transition(to CircuitState) {
	from := cb.state
	if from == to {
		return
	}

	cb.state = to

	level := slog.LevelInfo
	if to == StateOpen {
		level = slog.LevelWarn
	}

	slog.Log(nil, level, "circuit breaker state change",
		"cluster", cb.clusterID,
		"from", from.String(),
		"to", to.String(),
		"failures", cb.failures,
	)

	if cb.onStateChange != nil {
		go cb.onStateChange(cb.clusterID, from, to)
	}
}

// Reset resets the circuit breaker to closed state with zero failures.
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.state = StateClosed
	cb.failures = 0
	cb.probeAllowed = false
}
