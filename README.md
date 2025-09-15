<div align="center">
  <img src="https://xcdlwgvabmruuularsvn.supabase.co/storage/v1/object/public/val/h.png" alt="P0 Logo" width="120"/>
  <h1>json2k8s</h1>
</div>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes-blue)](https://kubernetes.io/)

An opinionated CLI tool to generate Kubernetes manifests from JSON configuration files. This tool is designed with specific conventions and limitations to provide a streamlined experience for generating production-ready Kubernetes YAML files.

**Current Limitations:**
- Only supports two hardcoded environments: `stage` and `prod`
- Secrets are handled exclusively using SOPS encryption
- Configuration format follows specific opinionated patterns

## 🚀 Features

- **JSON to YAML**: Convert JSON configuration files to Kubernetes YAML manifests
- **Multi-environment Support**: Generate manifests for different environments (stage, prod)
- **Secrets Management**: Handle environment-specific secrets and configurations
- **Flexible Output**: Customize output directories and file organization
- **CLI Interface**: Easy-to-use command-line interface with helpful options

## 📦 Installation

### Prerequisites

Before using json2k8s, you need to install SOPS for secret decryption:

```bash
# macOS
brew install sops

# Linux
curl -LO https://github.com/mozilla/sops/releases/latest/download/sops-v3.8.1.linux
sudo mv sops-v3.8.1.linux /usr/local/bin/sops
sudo chmod +x /usr/local/bin/sops

# Or using package managers
# Ubuntu/Debian
sudo apt-get install sops

# Arch Linux
sudo pacman -S sops
```

### Global Installation (Recommended)

Install json2k8s globally to use it from anywhere:

```bash
npm install -g json2k8s
```

Or with pnpm:

```bash
pnpm add -g json2k8s
```

### Local Installation

You can also install it locally in your project:

```bash
npm install json2k8s
pnpm add json2k8s
```

## 🎯 Usage

```bash
json2k8s <config-dir> [options]
```

For all available options, run:

```bash
json2k8s --help
```

### Examples

```bash
# Generate manifests for all apps in the config directory
json2k8s ./configs

# Generate manifests for a specific app
json2k8s ./configs --app my-app

# Specify custom output and secrets directories
json2k8s ./configs --out ./k8s-manifests --secrets-dir ./env-secrets

# Build specific app with custom directories
json2k8s ./configs -a my-app -o ./output -s ./secrets
```

## 📋 Configuration

json2k8s uses JSON configuration files to generate Kubernetes manifests. The tool supports two types of applications: **deployments** and **cronjobs**.

### Generated Kubernetes Resources

Based on your configuration, json2k8s can generate the following limited set of Kubernetes resources:

#### For Deployments:
- **Deployment** - Main application deployment
- **Service** - ClusterIP service for internal communication
- **Secret** - Environment variables and file secrets
- **Ingress** - Path-based and subdomain-based ingress rules
- **HorizontalPodAutoscaler (HPA)** - CPU and memory-based autoscaling
- **PersistentVolumeClaim (PVC)** - Persistent storage volumes

#### For CronJobs:
- **CronJob** - Scheduled job execution
- **Secret** - Environment variables and file secrets

### Configuration Structure

Each configuration file must follow this structure:

```json
{
  "name": "app-name",
  "type": "deployment" | "cronjob",
  "team": "team-name",
  "stage": { /* environment config */ },
  "prod": { /* environment config */ }
}
```

### Example Configuration

Here's a complete example using the `app-name.json` configuration:

```json
{
  "name": "app-name",
  "type": "deployment",
  "team": "app-team",
  "stage": {
    "replicaGroups": [
      {
        "name": "app-name",
        "replicas": 1,
        "env": [
          {
            "name": "SIMULATION_CACHE_TTL_SECONDS",
            "value": "10"
          },
          {
            "name": "DISABLE_SURGE",
            "value": "true"
          },
          {
            "name": "RUST_LOG",
            "value": "info"
          }
        ],
        "secrets": [],
        "resources": {
          "requests": {
            "cpu": "500m",
            "memory": "1024Mi"
          },
          "limits": {
            "cpu": "1000m",
            "memory": "2048Mi"
          }
        }
      }
    ],
    "shared": {
      "workflow": "critical",
      "imagePath": "switchboardlabs/rust-crossbar:rc_25_09_04_17_45d",
      "ports": [8080],
      "ingress": {
        "enabled": true,
        "subDomainCreated": true
      },
      "schedule": null,
      "startupProbe": {
        "httpGet": {
          "path": "/simulate/solana/mainnet/EAsoLo2uSvBDx3a5grqzfqBMg5RqpJVHRtXmjsFEc4LL?includeReceipts=true",
          "port": 8080
        },
        "initialDelaySeconds": 5,
        "periodSeconds": 5,
        "failureThreshold": 30
      }
    }
  },
  "prod": {
    "replicaGroups": [
      {
        "name": "app-name",
        "replicas": 1,
        "autoscaling": {
          "enabled": true,
          "minReplicas": 1,
          "maxReplicas": 4,
          "targetCPUUtilizationPercentage": 80,
          "targetMemoryUtilizationPercentage": 80
        },
        "env": [
          {
            "name": "SIMULATION_CACHE_TTL_SECONDS",
            "value": "10"
          },
          {
            "name": "DISABLE_SURGE",
            "value": "true"
          },
          {
            "name": "RUST_LOG",
            "value": "info"
          }
        ],
        "secrets": [],
        "resources": {
          "requests": {
            "cpu": "500m",
            "memory": "1024Mi"
          },
          "limits": {
            "cpu": "1000m",
            "memory": "2048Mi"
          }
        }
      }
    ],
    "shared": {
      "workflow": "critical",
      "imagePath": "switchboardlabs/rust-crossbar:rc_25_09_04_17_45d",
      "ports": [8080],
      "ingress": {
        "enabled": true,
        "subDomainCreated": true
      },
      "schedule": null,
      "startupProbe": {
        "httpGet": {
          "path": "/simulate/solana/mainnet/EAsoLo2uSvBDx3a5grqzfqBMg5RqpJVHRtXmjsFEc4LL?includeReceipts=true",
          "port": 8080
        },
        "initialDelaySeconds": 5,
        "periodSeconds": 5,
        "failureThreshold": 30
      }
    }
  }
}
```

### Configuration Sections Explained

#### Top-Level Fields

- **`name`** (string): Application name used for resource naming and labels
- **`type`** (string): Either `"deployment"` or `"cronjob"`
- **`team`** (string): Team name for labeling and organization
- **`stage`** (object, optional): Configuration for staging environment
- **`prod`** (object, optional): Configuration for production environment

#### Environment Configuration (`stage`/`prod`)

Each environment can have different configurations:

##### For Deployments:

**`replicaGroups`** (array): Define one or more deployment groups
- **`name`** (string): Unique name for the replica group
- **`replicas`** (number): Number of pod replicas
- **`env`** (array, optional): Environment variables
  - **`name`** (string): Environment variable name
  - **`value`** (string): Environment variable value
- **`secrets`** (array): Secret references
  - **`source`** (string): Key in secrets file
  - **`envVar`** (string, optional): Environment variable name
  - **`filePath`** (string, optional): File path for file secrets
  - **`name`** (string, optional): File name for file secrets
- **`resources`** (object): CPU and memory limits/requests
  - **`requests`**: Minimum resources required
  - **`limits`**: Maximum resources allowed
- **`autoscaling`** (object, optional): Horizontal Pod Autoscaler configuration
  - **`enabled`** (boolean): Enable autoscaling
  - **`minReplicas`** (number): Minimum number of replicas
  - **`maxReplicas`** (number): Maximum number of replicas
  - **`targetCPUUtilizationPercentage`** (number, optional): CPU target for scaling
  - **`targetMemoryUtilizationPercentage`** (number, optional): Memory target for scaling
- **`persistentVolumes`** (array, optional): Persistent storage volumes
  - **`name`** (string): Volume name
  - **`mountPath`** (string): Mount path in container
  - **`size`** (string): Storage size (e.g., "10Gi")
  - **`accessMode`** (string): Access mode (ReadWriteOnce, ReadWriteMany, ReadOnlyMany)
  - **`storageClass`** (string, optional): Storage class name
  - **`subPath`** (string, optional): Subpath within the volume

**`shared`** (object): Shared configuration across replica groups
- **`workflow`** (string): Workload type (`"critical"` or `"noncritical"`)
- **`imagePath`** (string, optional): Full container image path
- **`imageTag`** (string, optional): Image tag (used with default registry)
- **`ports`** (array): Container ports to expose
- **`command`** (array, optional): Container command
- **`args`** (array, optional): Container arguments
- **`ingress`** (object, optional): Ingress configuration
  - **`enabled`** (boolean): Enable ingress
  - **`subDomainCreated`** (boolean): Create subdomain ingress
- **`livenessProbe`** (object, optional): Liveness probe configuration
- **`readinessProbe`** (object, optional): Readiness probe configuration
- **`startupProbe`** (object, optional): Startup probe configuration
- **`sidecar`** (object, optional): Sidecar container configuration
  - **`enabled`** (boolean): Enable sidecar
  - **`image`** (string): Sidecar image
  - **`name`** (string, optional): Sidecar container name
  - **`env`** (array, optional): Sidecar environment variables
  - **`secrets`** (array, optional): Sidecar secrets
  - **`resources`** (object, optional): Sidecar resource limits
  - **`securityContext`** (object, optional): Sidecar security context
  - **`volumeMounts`** (array, optional): Sidecar volume mounts

##### For CronJobs:

**`cronjob`** (object): CronJob-specific configuration
- **`workflow`** (string): Workload type (`"critical"`, `"noncritical"`, or `"points"`)
- **`schedule`** (string): Cron schedule expression
- **`concurrencyPolicy`** (string): Concurrency policy (`"Allow"`, `"Forbid"`, `"Replace"`)
- **`successfulJobsHistoryLimit`** (number, optional): Number of successful jobs to keep
- **`failedJobsHistoryLimit`** (number, optional): Number of failed jobs to keep
- **`startingDeadlineSeconds`** (number, optional): Starting deadline for jobs
- **`backoffLimit`** (number, optional): Number of retries for failed jobs
- **`ttlSecondsAfterFinished`** (number, optional): TTL for completed jobs
- **`suspend`** (boolean, optional): Suspend the cronjob
- **`imageTag`** (string, optional): Image tag
- **`imagePath`** (string, optional): Full image path
- **`command`** (array, optional): Container command
- **`args`** (array, optional): Container arguments
- **`env`** (array, optional): Environment variables
- **`secrets`** (array, optional): Secret references
- **`resources`** (object): Resource limits and requests

### Resource Limitations

json2k8s is designed with specific limitations to provide a streamlined experience:

1. **Limited Resource Types**: Only generates the core Kubernetes resources listed above
2. **Two Environments Only**: Supports only `stage` and `prod` environments
3. **SOPS Secrets**: Secrets must be managed using SOPS encryption
4. **Opinionated Patterns**: Follows specific naming and organizational conventions
5. **Single Namespace**: All resources are created in the `default` namespace
6. **Fixed Ingress**: Uses nginx ingress class with specific domain patterns
7. **Limited Probe Types**: Only supports HTTP GET probes
8. **No Custom Resources**: Cannot generate custom resource definitions (CRDs)

### Secrets Management

Secrets are handled through SOPS-encrypted files in your secrets directory:
- `stage.secret.json` - Staging environment secrets
- `prod.secret.json` - Production environment secrets

Each secret entry should have a `source` key that matches the key in your secrets file, and either:
- `envVar`: To inject as an environment variable
- `filePath` + `name`: To mount as a file in the container


## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues

If you encounter any issues or have questions, please file an issue on the [GitHub repository](https://github.com/0dotxyz/json2k8s/issues).

*A·RABBANI·L·F·COS·TERTIVM·FECIT*

---

Made with ❤️ for the Kubernetes community
