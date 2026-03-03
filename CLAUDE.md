# Elastic Cloud Kubernetes UI

This project is to create a UI for running as part of Elastic Cloud Kubernetes giving a similar look, feel and experience to Elastic Cloud & Elastic Cloud Enterprise.

## Key Requirements

- Must use Elastic EUI
- Must be a continer which can run as part of Elastic Cloud Kubernetes
- Must be secure by design
- Must support all features that Elastic Cloud Kubernetes supports
- Must allow users to deploy, managage, view and monitor their clusters like in cloud
- Must be easily maintainable so using Open API Specs or whatever the Elastic Cloud Kuberetes operator uses.
- I have cloned both the Elastic Cloud Kuberetes repo and Elastic Cloud/Elastic Cloud Enterprise repositories which can be found at the following paths
  - ../../Elastic/cloud-on-k8s/
  - ../../Elastic/cloud/
- Must provide RBAC like on Elastic Cloud but ideally with users being able to belong to an 'Org' or many 'Orgs'
- Must use Kubernetes pattern best practice leveraging existing ECK persistance funcitonality
- Must have audit loggging ideally in Otel format

## Ideal Requiremetns

- We use the Existing UI and have a pipeline which 'ports it' for ECK
- The UI should use a service account for auth to the cluster
