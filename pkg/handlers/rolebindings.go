package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/gorilla/mux"

	apierrors "github.com/jamesagarside/eck-ui/pkg/errors"
	"github.com/jamesagarside/eck-ui/pkg/middleware"
	"github.com/jamesagarside/eck-ui/pkg/rbac"
)

// RoleBindingsListHandler returns a handler that lists all ECKUIRoleBinding resources.
func RoleBindingsListHandler(crdClient *rbac.CRDClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		bindings, err := crdClient.List(r.Context())
		if err != nil {
			slog.Error("failed to list role bindings", "error", err)
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		if bindings == nil {
			bindings = []rbac.ECKUIRoleBinding{}
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(bindings)
	}
}

// RoleBindingCreateHandler returns a handler that creates a new ECKUIRoleBinding.
// Only callers with the platform-admin role are allowed.
func RoleBindingCreateHandler(crdClient *rbac.CRDClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role := middleware.PlatformRoleFromContext(r.Context())
		if role != rbac.RolePlatformAdmin {
			apierrors.WriteError(w, apierrors.New(
				http.StatusForbidden, "Forbidden",
				"Only platform-admin users can manage role bindings.",
			))
			return
		}

		var binding rbac.ECKUIRoleBinding
		if err := json.NewDecoder(r.Body).Decode(&binding); err != nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest, "BadRequest",
				"Invalid JSON body: "+err.Error(),
			))
			return
		}

		// Validate role field.
		if !rbac.IsValidRole(binding.Spec.Role) {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest, "BadRequest",
				"Invalid role: must be one of platform-admin, deployment-manager, platform-viewer, deployment-viewer.",
			))
			return
		}

		// Validate subjects non-empty.
		if len(binding.Spec.Subjects) == 0 {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest, "BadRequest",
				"Subjects must not be empty.",
			))
			return
		}

		// Validate each subject has valid kind and non-empty name.
		for _, subj := range binding.Spec.Subjects {
			if subj.Kind != "User" && subj.Kind != "Group" {
				apierrors.WriteError(w, apierrors.New(
					http.StatusBadRequest, "BadRequest",
					"Subject kind must be 'User' or 'Group'.",
				))
				return
			}
			if subj.Name == "" {
				apierrors.WriteError(w, apierrors.New(
					http.StatusBadRequest, "BadRequest",
					"Subject name must not be empty.",
				))
				return
			}
		}

		created, err := crdClient.Create(r.Context(), &binding)
		if err != nil {
			slog.Error("failed to create role binding", "error", err)
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)
	}
}

// RoleBindingDeleteHandler returns a handler that deletes an ECKUIRoleBinding by name.
// Only callers with the platform-admin role are allowed.
func RoleBindingDeleteHandler(crdClient *rbac.CRDClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role := middleware.PlatformRoleFromContext(r.Context())
		if role != rbac.RolePlatformAdmin {
			apierrors.WriteError(w, apierrors.New(
				http.StatusForbidden, "Forbidden",
				"Only platform-admin users can manage role bindings.",
			))
			return
		}

		name := mux.Vars(r)["name"]
		if name == "" {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest, "BadRequest",
				"Role binding name is required.",
			))
			return
		}

		if err := crdClient.Delete(r.Context(), name); err != nil {
			slog.Error("failed to delete role binding", "name", name, "error", err)
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted", "name": name})
	}
}
