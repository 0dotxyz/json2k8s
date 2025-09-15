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


## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues

If you encounter any issues or have questions, please file an issue on the [GitHub repository](https://github.com/0dotxyz/json2k8s/issues).

*A·RABBANI·L·F·COS·TERTIVM·FECIT*

---

Made with ❤️ for the Kubernetes community
