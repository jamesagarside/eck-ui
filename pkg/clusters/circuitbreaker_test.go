package clusters

import (
	"sync"
	"testing"
	"time"
)

func TestCircuitBreaker_InitialState(t *testing.T) {
	cb := NewCircuitBreaker("test", 3, 30*time.Second)
	if cb.State() != StateClosed {
		t.Errorf("expected initial state CLOSED, got %v", cb.State())
	}
}

func TestCircuitBreaker_ClosedToOpen(t *testing.T) {
	cb := NewCircuitBreaker("test", 3, 30*time.Second)

	// 3 consecutive failures should open the circuit.
	cb.RecordFailure()
	cb.RecordFailure()
	if cb.State() != StateClosed {
		t.Error("expected CLOSED after 2 failures")
	}

	cb.RecordFailure()
	if cb.State() != StateOpen {
		t.Errorf("expected OPEN after 3 failures, got %v", cb.State())
	}
}

func TestCircuitBreaker_SuccessResetsCounter(t *testing.T) {
	cb := NewCircuitBreaker("test", 3, 30*time.Second)

	cb.RecordFailure()
	cb.RecordFailure()
	cb.RecordSuccess()
	cb.RecordFailure()
	cb.RecordFailure()

	// Should still be closed — success reset the counter.
	if cb.State() != StateClosed {
		t.Errorf("expected CLOSED after success reset, got %v", cb.State())
	}
}

func TestCircuitBreaker_OpenToHalfOpen(t *testing.T) {
	cb := NewCircuitBreaker("test", 3, 50*time.Millisecond)

	// Open the circuit.
	cb.RecordFailure()
	cb.RecordFailure()
	cb.RecordFailure()
	if cb.State() != StateOpen {
		t.Fatal("expected OPEN")
	}

	// Wait for recovery timeout.
	time.Sleep(60 * time.Millisecond)

	if cb.State() != StateHalfOpen {
		t.Errorf("expected HALF-OPEN after recovery timeout, got %v", cb.State())
	}
}

func TestCircuitBreaker_HalfOpenProbeSuccess(t *testing.T) {
	cb := NewCircuitBreaker("test", 3, 50*time.Millisecond)

	cb.RecordFailure()
	cb.RecordFailure()
	cb.RecordFailure()

	time.Sleep(60 * time.Millisecond)

	// Should allow one probe.
	allowed, state := cb.AllowRequest()
	if !allowed || state != StateHalfOpen {
		t.Errorf("expected probe allowed in HALF-OPEN, got allowed=%v state=%v", allowed, state)
	}

	// Second request should be blocked.
	allowed2, _ := cb.AllowRequest()
	if allowed2 {
		t.Error("expected second request blocked in HALF-OPEN")
	}

	// Probe success closes the circuit.
	cb.RecordSuccess()
	if cb.State() != StateClosed {
		t.Errorf("expected CLOSED after probe success, got %v", cb.State())
	}
}

func TestCircuitBreaker_HalfOpenProbeFailure(t *testing.T) {
	cb := NewCircuitBreaker("test", 3, 50*time.Millisecond)

	cb.RecordFailure()
	cb.RecordFailure()
	cb.RecordFailure()

	time.Sleep(60 * time.Millisecond)

	// Allow probe.
	cb.AllowRequest()

	// Probe fails — should reopen.
	cb.RecordFailure()
	if cb.State() != StateOpen {
		t.Errorf("expected OPEN after probe failure, got %v", cb.State())
	}
}

func TestCircuitBreaker_AllowRequestClosed(t *testing.T) {
	cb := NewCircuitBreaker("test", 3, 30*time.Second)

	allowed, state := cb.AllowRequest()
	if !allowed || state != StateClosed {
		t.Errorf("expected allowed=true state=CLOSED, got %v %v", allowed, state)
	}
}

func TestCircuitBreaker_AllowRequestOpen(t *testing.T) {
	cb := NewCircuitBreaker("test", 3, 30*time.Second)

	cb.RecordFailure()
	cb.RecordFailure()
	cb.RecordFailure()

	allowed, state := cb.AllowRequest()
	if allowed || state != StateOpen {
		t.Errorf("expected allowed=false state=OPEN, got %v %v", allowed, state)
	}
}

func TestCircuitBreaker_ConcurrentAccess(t *testing.T) {
	cb := NewCircuitBreaker("test", 100, 30*time.Second)

	var wg sync.WaitGroup
	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cb.RecordFailure()
			cb.AllowRequest()
			cb.RecordSuccess()
		}()
	}
	wg.Wait()

	// Should not panic or deadlock. State should be valid.
	state := cb.State()
	if state != StateClosed && state != StateOpen && state != StateHalfOpen {
		t.Errorf("unexpected state after concurrent access: %v", state)
	}
}

func TestCircuitBreaker_Reset(t *testing.T) {
	cb := NewCircuitBreaker("test", 3, 30*time.Second)

	cb.RecordFailure()
	cb.RecordFailure()
	cb.RecordFailure()

	cb.Reset()
	if cb.State() != StateClosed {
		t.Errorf("expected CLOSED after reset, got %v", cb.State())
	}
}

func TestCircuitBreaker_StateChangeCallback(t *testing.T) {
	cb := NewCircuitBreaker("test", 1, 30*time.Second)

	var called bool
	var fromState, toState CircuitState
	cb.SetOnStateChange(func(clusterID string, from, to CircuitState) {
		called = true
		fromState = from
		toState = to
	})

	cb.RecordFailure()

	// Give goroutine time to run.
	time.Sleep(10 * time.Millisecond)

	if !called {
		t.Error("expected state change callback to be called")
	}
	if fromState != StateClosed || toState != StateOpen {
		t.Errorf("expected CLOSED->OPEN, got %v->%v", fromState, toState)
	}
}
