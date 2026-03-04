export const FILEBEAT_CONTAINER_LOGS_TEMPLATE = `filebeat.inputs:
- type: container
  paths:
    - /var/log/containers/*.log
  processors:
    - add_kubernetes_metadata:
        host: \${NODE_NAME}
        matchers:
          - logs_path:
              logs_path: "/var/log/containers/"

output.elasticsearch:
  hosts: ["\${ELASTICSEARCH_HOST}"]
  username: "\${ELASTICSEARCH_USERNAME}"
  password: "\${ELASTICSEARCH_PASSWORD}"

logging.level: info
logging.to_files: true
logging.files:
  path: /var/log/filebeat
  name: filebeat
  keepfiles: 7
  permissions: 0640
`;

export const METRICBEAT_SYSTEM_METRICS_TEMPLATE = `metricbeat.modules:
- module: system
  period: 10s
  metricsets:
    - cpu
    - load
    - memory
    - network
    - process
    - process_summary
    - socket_summary
  process.include_top_n:
    by_cpu: 5
    by_memory: 5

- module: system
  period: 1m
  metricsets:
    - filesystem
    - fsstat
  processors:
    - drop_event.when.regexp:
        system.filesystem.mount_point: '^/(sys|cgroup|proc|dev|etc|host|lib|snap)($|/)'

output.elasticsearch:
  hosts: ["\${ELASTICSEARCH_HOST}"]
  username: "\${ELASTICSEARCH_USERNAME}"
  password: "\${ELASTICSEARCH_PASSWORD}"

logging.level: info
`;
