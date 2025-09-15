import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { build } from './generates.js';

const program = new Command();

program
    .name('json2k8s')
    .description('CLI to generate Kubernetes manifests from JSON')
    .version('0.1.0')
    .argument('<config-dir>', 'directory containing JSON configuration files')
    .option('-a, --app <name>', 'specific app name to build (builds all if not specified)')
    .option('-o, --out <directory>', 'output directory for generated manifests', 'build')
    .option('-s, --secrets-dir <directory>', 'directory containing secrets files', 'secrets')
    .action(async (configDir: string, options: { app?: string; out: string; secretsDir: string }) => {
        try {
            console.log(`🚀 Processing config directory: ${configDir}`);
            if (options.app) {
                console.log(`📦 Building specific app: ${options.app}`);
            } else {
                console.log(`📦 Building all apps in directory`);
            }
            console.log(`📁 Output directory: ${options.out}`);
            console.log(`🔐 Secrets directory: ${options.secretsDir}`);

            // Validate inputs
            validateInputs(configDir, options.app, options.out, options.secretsDir);

            // Call build function with clean arguments
            await build({
                configPath: configDir,
                appName: options.app,
                buildDir: options.out,
                secretsDir: options.secretsDir
            });

            console.log(`✅ Successfully generated Kubernetes manifests in: ${options.out}`);

        } catch (error) {
            console.error('❌ Error:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

function validateInputs(configDir: string, appName: string | undefined, outputDir: string, secretsDir: string) {
    // Check if config directory exists
    if (!fs.existsSync(configDir)) {
        console.error(`❌ Error: Config directory "${configDir}" does not exist`);
        process.exit(1);
    }

    // Check if it's actually a directory
    if (!fs.statSync(configDir).isDirectory()) {
        console.error(`❌ Error: "${configDir}" is not a directory`);
        process.exit(1);
    }

    // If specific app name is provided, check if the JSON file exists
    if (appName) {
        const appFile = path.join(configDir, `${appName}.json`);
        if (!fs.existsSync(appFile)) {
            console.error(`❌ Error: App file "${appFile}" does not exist`);
            process.exit(1);
        }
    } else {
        // Check if there are any JSON files in the directory
        const jsonFiles = fs.readdirSync(configDir).filter(f => f.endsWith('.json'));
        if (jsonFiles.length === 0) {
            console.error(`❌ Error: No JSON files found in directory "${configDir}"`);
            process.exit(1);
        }
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`📁 Created output directory: ${outputDir}`);
    }

    // Check if secrets directory exists
    if (!fs.existsSync(secretsDir)) {
        console.error(`❌ Error: Secrets directory "${secretsDir}" does not exist`);
        console.log(`💡 Make sure the secrets directory contains stage.secret.json and prod.secret.json files`);
        process.exit(1);
    }
}

// Parse command line arguments
program.parse();
