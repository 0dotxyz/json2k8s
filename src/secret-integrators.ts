import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Interface for secret integrators that can decrypt secrets from different sources
 */
export interface SecretIntegrator {
    /**
     * Decrypt secrets for a given environment
     * @param env - The environment ('stage' or 'prod')
     * @param secretsDir - Directory containing secret files
     * @returns Decrypted secrets as key-value pairs
     */
    decryptSecrets(env: 'stage' | 'prod', secretsDir?: string): Record<string, string>;
}

/**
 * SOPS-based secret integrator
 * Uses SOPS (Secrets OPerationS) to decrypt encrypted secret files
 */
export class SopsIntegrator implements SecretIntegrator {
    decryptSecrets(env: 'stage' | 'prod', secretsDir: string = 'secrets'): Record<string, string> {
        const secretsPath = path.resolve(secretsDir, `${env}.secret.json`);
        try {
            const stdout = execSync(`sops -d ${secretsPath}`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'inherit']
            });
            return JSON.parse(stdout);
        } catch (err) {
            console.error(`❌ Failed to decrypt secrets for ${env}:`, err);
            process.exit(1);
        }
    }
}

/**
 * Factory function to create secret integrators
 * @param type - Type of integrator to create
 * @returns Secret integrator instance
 */
export function createSecretIntegrator(type: 'sops' = 'sops'): SecretIntegrator {
    switch (type) {
        case 'sops':
            return new SopsIntegrator();
        default:
            throw new Error(`Unsupported secret integrator type: ${type}`);
    }
}

/**
 * Default secret integrator instance using SOPS
 */
export const defaultSecretIntegrator = new SopsIntegrator();
