# Upgrade Guide

This guide covers upgrading ECK UI between versions.

## General Upgrade Steps

1. **Backup your configuration**
   ```bash
   kubectl get secret eck-ui-config -o yaml > eck-ui-config-backup.yaml
   ```

2. **Check for breaking changes** in the [CHANGELOG](CHANGELOG.md)

3. **Update the Helm chart**
   ```bash
   helm repo update
   helm upgrade eck-ui eck-ui/eck-ui --namespace eck-ui --values values.yaml
   ```

4. **Verify the deployment**
   ```bash
   kubectl rollout status deployment/eck-ui -n eck-ui
   kubectl logs -f deployment/eck-ui -n eck-ui
   ```

## Version-Specific Notes

### Upgrading to 0.2.x

*Future version - notes will be added when released*

### Upgrading to 0.1.x

Initial release - no upgrade path required.

## Rolling Back

If an upgrade fails, roll back to the previous version:

```bash
# List release history
helm history eck-ui -n eck-ui

# Roll back to previous revision
helm rollback eck-ui [REVISION] -n eck-ui
```

## Database Migrations

ECK UI uses Kubernetes ConfigMaps and Secrets for persistent state. There are no database migrations required.

Organization and user data is stored in:
- `ConfigMap/eck-ui-orgs` - Organization definitions
- `Secret/eck-ui-users` - User credentials (if using local auth)

## Configuration Changes Between Versions

### 0.1.0

Initial configuration schema:

```yaml
server:
  port: 8080
  gracefulShutdownTimeout: 30s
logging:
  level: info
  format: json
auth:
  type: kubernetes
kubernetes:
  inCluster: true
cors:
  allowedOrigins: []
```

## Health Checks

After upgrading, verify ECK UI is healthy:

```bash
# Check pod status
kubectl get pods -n eck-ui -l app.kubernetes.io/name=eck-ui

# Check readiness
kubectl exec -it deployment/eck-ui -n eck-ui -- curl -s localhost:8080/api/health

# Check logs for errors
kubectl logs deployment/eck-ui -n eck-ui --since=5m | grep -i error
```

## Support

If you encounter issues during upgrade:

1. Check the [troubleshooting guide](docs/troubleshooting.md)
2. Review [GitHub Issues](https://github.com/jamesagarside/eck-ui/issues)
3. Open a new issue with upgrade logs and version information
