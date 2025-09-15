<div align="center">
  <img src="https://xcdlwgvabmruuularsvn.supabase.co/storage/v1/object/public/val/h.png" alt="P0 Logo" width="120"/>
  <h1>json2k8s</h1>
</div>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes-blue)](https://kubernetes.io/)

A powerful CLI tool to generate Kubernetes manifests from JSON configuration files. Transform your application configurations into production-ready Kubernetes YAML files with ease.

## 🚀 Features

- **JSON to YAML**: Convert JSON configuration files to Kubernetes YAML manifests
- **Multi-environment Support**: Generate manifests for different environments (stage, prod)
- **Secrets Management**: Handle environment-specific secrets and configurations
- **Flexible Output**: Customize output directories and file organization
- **CLI Interface**: Easy-to-use command-line interface with helpful options

## 📦 Installation

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

### Basic Usage

```bash
json2k8s <config-dir>
```

### Advanced Usage

```bash
json2k8s <config-dir> [options]
```

### Options

- `-a, --app <name>` - Build a specific app (builds all apps if not specified)
- `-o, --out <directory>` - Output directory for generated manifests (default: `build`)
- `-s, --secrets-dir <directory>` - Directory containing secrets files (default: `secrets`)

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

## 📁 Project Structure

Your project should be organized like this:

```
project/
├── configs/                 # JSON configuration files
│   ├── app1.json
│   ├── app2.json
│   └── ...
├── secrets/                 # Environment-specific secrets
│   ├── stage.secret.json
│   └── prod.secret.json
└── build/                   # Generated manifests (default output)
    ├── app1/
    │   ├── stage/
    │   └── prod/
    └── app2/
        ├── stage/
        └── prod/
```

## 🔧 Configuration

### JSON Configuration Format

Each app configuration file should be a JSON file with the following structure:

```json
{
  "name": "my-app",
  "image": "my-app:latest",
  "replicas": 3,
  "ports": [
    {
      "containerPort": 3000,
      "servicePort": 80
    }
  ],
  "env": {
    "NODE_ENV": "production",
    "DATABASE_URL": "postgresql://..."
  }
}
```

### Secrets Format

Environment-specific secrets should be in separate JSON files:

**stage.secret.json:**
```json
{
  "DATABASE_URL": "postgresql://stage-db:5432/myapp",
  "API_KEY": "stage-api-key"
}
```

**prod.secret.json:**
```json
{
  "DATABASE_URL": "postgresql://prod-db:5432/myapp",
  "API_KEY": "prod-api-key"
}
```

## 🏗️ Generated Output

The tool generates the following Kubernetes manifests for each app and environment:

- **Deployment**: Application deployment configuration
- **Service**: Service configuration for networking
- **Secret**: Environment-specific secrets

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues

If you encounter any issues or have questions, please file an issue on the [GitHub repository](https://github.com/0dotxyz/json2k8s/issues).

*A·RABBANI·L·F·COS·TERTIVM·FECIT*

---

Made with ❤️ for the Kubernetes community
