import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { SecretIntegrator, defaultSecretIntegrator } from './secret-integrators';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IngressSchema = z.object({
    enabled: z.boolean(),
    subDomainCreated: z.boolean(),
});

const AutoscalingSchema = z.object({
    enabled: z.boolean(),
    minReplicas: z.number(),
    maxReplicas: z.number(),
    targetCPUUtilizationPercentage: z.number().optional(),
    targetMemoryUtilizationPercentage: z.number().optional(),
}).optional();

const SecretVarSchema = z.object({
    source: z.string(),
    envVar: z.string().optional(),
    filePath: z.string().optional(),
    name: z.string().optional(),
}).refine(
    (val) => {
        if (val.envVar) return true;
        if (val.filePath && val.name) return true;
        return false;
    },
    {
        message: 'Either envVar must be set, or both filePath and name must be set',
        path: ['envVar', 'filePath', 'name'],
    }
);

const PersistentVolumeSchema = z.object({
    name: z.string(),
    mountPath: z.string(),
    subPath: z.string().optional(),
    storageClass: z.string().optional(),
    size: z.string(),
    accessMode: z.enum(['ReadWriteOnce', 'ReadWriteMany', 'ReadOnlyMany']),
});

const SidecarSchema = z.object({
    enabled: z.boolean(),
    image: z.string(),
    name: z.string().optional(),
    env: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    secrets: z.array(SecretVarSchema).optional(),
    resources: z.object({
        requests: z.object({ cpu: z.string(), memory: z.string() }),
        limits: z.object({ cpu: z.string(), memory: z.string() }),
    }).optional(),
    securityContext: z.any().optional(),
    volumeMounts: z.array(z.any()).optional(),
}).optional();

const ReplicaGroupSchema = z.object({
    name: z.string(),
    replicas: z.number(),
    env: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    secrets: z.array(SecretVarSchema),
    persistentVolumes: z.array(PersistentVolumeSchema).optional(),
    resources: z.object({
        requests: z.object({ cpu: z.string(), memory: z.string() }),
        limits: z.object({ cpu: z.string(), memory: z.string() }),
    }),
    autoscaling: AutoscalingSchema,
    deploymentStrategy: z.enum(['RollingUpdate', 'Recreate']).optional(),
});

const CronJobEnvSchema = z.object({
    cronjob: z.object({
        workflow: z.enum(['critical', 'noncritical', 'points']),
        schedule: z.string(),
        concurrencyPolicy: z.enum(['Allow', 'Forbid', 'Replace']),
        successfulJobsHistoryLimit: z.number().optional(),
        failedJobsHistoryLimit: z.number().optional(),
        startingDeadlineSeconds: z.number().optional(),
        backoffLimit: z.number().optional(),
        ttlSecondsAfterFinished: z.number().optional(),
        env: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
        secrets: z.array(SecretVarSchema).optional(),
        suspend: z.boolean().optional(),
        imageTag: z.string().optional(),
        imagePath: z.string().optional(),
        command: z.array(z.string()).optional(),
        args: z.array(z.string()).optional(),
        resources: z.object({
            requests: z.object({ cpu: z.string(), memory: z.string() }),
            limits: z.object({ cpu: z.string(), memory: z.string() }),
        }),
    }),
});

const SharedSchema = z.object({
    workflow: z.enum(['critical', 'noncritical']),
    ports: z.array(z.number()),
    imageTag: z.string().optional(),
    imagePath: z.string().optional(),
    command: z.array(z.string()).optional(),
    args: z.array(z.string()).optional(),
    schedule: z.string().nullable(),
    livenessProbe: z.object({
        httpGet: z.object({ path: z.string(), port: z.number() }),
        initialDelaySeconds: z.number(),
        periodSeconds: z.number(),
    }).optional(),
    readinessProbe: z.object({
        httpGet: z.object({ path: z.string(), port: z.number() }),
        initialDelaySeconds: z.number(),
        periodSeconds: z.number(),
    }).optional(),
    startupProbe: z.object({
        httpGet: z.object({ path: z.string(), port: z.number() }),
        initialDelaySeconds: z.number(),
        periodSeconds: z.number(),
        failureThreshold: z.number().optional(),
    }).optional(),
    ingress: IngressSchema.optional(),
    sidecar: SidecarSchema,
});

const EnvSchema = z.object({
    replicaGroups: z.array(ReplicaGroupSchema),
    shared: SharedSchema,
});

const AppSchema = z.discriminatedUnion('type', [
    z.object({
        name: z.string(),
        type: z.literal('deployment'),
        team: z.string(),
        stage: EnvSchema.optional(),
        prod: EnvSchema.optional(),
    }),
    z.object({
        name: z.string(),
        type: z.literal('cronjob'),
        team: z.string(),
        stage: CronJobEnvSchema.optional(),
        prod: CronJobEnvSchema.optional(),
    }),
]);

function trimExtension(filename: string): string {
    return filename.replace(/\.[^/.]+$/, '');
}

function loadDecryptedSecrets(env: 'stage' | 'prod', secretsDir: string = 'secrets', integrator: SecretIntegrator = defaultSecretIntegrator): Record<string, string> {
    return integrator.decryptSecrets(env, secretsDir);
}

function validateUniqueReplicaGroupNames(envConfig: z.infer<typeof EnvSchema>, env: string, appName: string) {
    const names = envConfig.replicaGroups.map((group: z.infer<typeof ReplicaGroupSchema>) => group.name);
    const seen = new Set<string>();
    for (const name of names) {
        if (seen.has(name)) {
            throw new Error(`Duplicate replica group name "${name}" in environment "${env}" for app "${appName}".`);
        }
        seen.add(name);
    }
}

type SecretManifestInput = {
    appName: string;
    name: string; // resource name (group name or cronjob name)
    secrets: SecretVar[];
    secretsForEnv: Record<string, string>;
    env: string;
    labels?: Record<string, string>;
};

function createSecretManifest(input: SecretManifestInput) {
    const { appName, name, secrets, secretsForEnv, env, labels = {} } = input;
    const data: Record<string, string> = {};

    for (const s of secrets) {
        const value = secretsForEnv[s.source];
        if (value === undefined) {
            console.error(`❌ Secret "${s.source}" not found in ${env}.secret.json`);
            process.exit(1);
        }
        if (s.envVar) {
            data[s.envVar] = Buffer.from(value).toString('base64');
        } else if (s.name) {
            data[`${trimExtension(s.name)}-file-secrets`] = Buffer.from(value).toString('base64');
        }
    }

    return {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
            name: `${name}-secrets`,
            namespace: 'default',
            labels: {
                app: appName,
                ...labels,
            },
        },
        type: 'Opaque',
        data,
    };
}

type SecretVar = {
    source: string;
    envVar?: string;
    filePath?: string;
    name?: string;
};

type EnvVar = { name: string; value: string };

type ContainerInput = {
    name: string;
    appName: string;
    imageTag: string | undefined;
    imagePath: string | undefined;
    secrets: SecretVar[];
    command?: string[];
    args?: string[];
    env?: EnvVar[];
    resources: {
        requests: { cpu: string; memory: string };
        limits: { cpu: string; memory: string };
    };
    ports?: number[];
    livenessProbe?: any;
    readinessProbe?: any;
    startupProbe?: any;
    persistentVolumes?: any[];
};

function createContainer(input: ContainerInput & { fileSecrets?: SecretVar[] }) {
    const {
        name,
        appName,
        imageTag,
        imagePath,
        secrets,
        command,
        args,
        env,
        resources,
        ports,
        livenessProbe,
        readinessProbe,
        startupProbe,
        fileSecrets = [],
        persistentVolumes = [],
    } = input;

    const envSecrets = secrets.filter(s => s.envVar);

    const container: any = {
        name,
        image: imagePath ? imagePath : `us-central1-docker.pkg.dev/mrgn-shared/shared-artifact-registry/${appName}:${imageTag}`,
        imagePullPolicy: "Always",
        resources,
        env: [
            ...envSecrets.map(s => ({
                name: s.envVar,
                valueFrom: {
                    secretKeyRef: {
                        name: `${name}-secrets`,
                        key: s.envVar,
                    },
                },
            })),
            ...(env || []),
        ],
    };

    if (ports?.length) {
        container.ports = ports.map(p => ({ containerPort: p }));
    }

    if (command) container.command = command;
    if (args) container.args = args;

    if (livenessProbe) container.livenessProbe = livenessProbe;
    if (readinessProbe) container.readinessProbe = readinessProbe;
    if (startupProbe) container.startupProbe = startupProbe;

    if (fileSecrets.length > 0) {
        container.volumeMounts = fileSecrets.map(s => {
            const cleanName = trimExtension(s.name!);
            return {
                name: `${cleanName}-file-secrets`,
                mountPath: path.posix.join(s.filePath!, s.name!),
                subPath: s.name!,
                readOnly: true,
            };
        });
    }

    // Add persistent volume mounts
    if (persistentVolumes.length > 0) {
        const persistentVolumeMounts = persistentVolumes.map(volume => ({
            name: volume.name,
            mountPath: volume.mountPath,
            ...(volume.subPath && { subPath: volume.subPath }),
        }));

        // Combine with existing volume mounts
        container.volumeMounts = [
            ...(container.volumeMounts || []),
            ...persistentVolumeMounts,
        ];
    }

    return container;
}

function createSidecarContainer(containerName: string, sidecarConfig: any) {
    const sidecarName = sidecarConfig.name || `${containerName}-sidecar`;

    // Handle secrets for sidecar
    const envSecrets = sidecarConfig.secrets?.filter((s: any) => s.envVar) || [];
    const fileSecrets = sidecarConfig.secrets?.filter((s: any) => s.filePath && s.name) || [];

    const container: any = {
        name: sidecarName,
        image: sidecarConfig.image,
        imagePullPolicy: "Always",
        env: [
            ...envSecrets.map((s: any) => ({
                name: s.envVar,
                valueFrom: {
                    secretKeyRef: {
                        name: `${containerName}-secrets`,
                        key: s.envVar,
                    },
                },
            })),
            ...(sidecarConfig.env || []),
        ],
        resources: sidecarConfig.resources || {
            requests: { cpu: "100m", memory: "128Mi" },
            limits: { cpu: "200m", memory: "256Mi" }
        },
        securityContext: sidecarConfig.securityContext,
    };

    // Add volume mounts for file secrets
    if (fileSecrets.length > 0) {
        container.volumeMounts = fileSecrets.map((s: any) => {
            const cleanName = trimExtension(s.name!);
            return {
                name: `${cleanName}-sidecar-file-secrets`,
                mountPath: path.posix.join(s.filePath!, s.name!),
                subPath: s.name!,
                readOnly: true,
            };
        });
    }

    // Add custom volume mounts if specified
    if (sidecarConfig.volumeMounts) {
        container.volumeMounts = [
            ...(container.volumeMounts || []),
            ...sidecarConfig.volumeMounts
        ];
    }

    return container;
}

function createPodTemplate(labels: any, container: any, shared: any, fileSecrets?: SecretVar[], persistentVolumes?: any[]) {
    const containers = [container];

    // Add sidecar container if enabled
    if (shared.sidecar?.enabled) {
        const sidecarContainer = createSidecarContainer(container.name, shared.sidecar);
        containers.push(sidecarContainer);
    }

    const podSpec: any = {
        metadata: {
            labels,
            annotations: {
                'rollout-trigger': new Date().toISOString(),
                "prometheus.io/scrape": "true",
                "prometheus.io/port": "9000",
                "prometheus.io/path": "/metrics",
            },
        },
        spec: {
            containers,
            tolerations: [{
                key: "workload-type",
                operator: "Equal",
                value: shared.workflow,
                effect: "NoSchedule",
            }],
            nodeSelector: { "node-pool": shared.workflow },
            restartPolicy: 'Always',
        },
    };

    const volumes = [];

    // Add volumes for main container file secrets
    if (fileSecrets && fileSecrets.length > 0) {
        volumes.push(...fileSecrets.map(s => ({
            name: `${trimExtension(s.name!)}-file-secrets`,
            secret: {
                secretName: `${container.name}-secrets`,
                items: [
                    {
                        key: `${s.name}-file-secrets`,
                        path: s.name!,
                    },
                ],
            },
        })));
    }

    // Add volumes for sidecar file secrets
    if (shared.sidecar?.enabled && shared.sidecar.secrets) {
        const sidecarFileSecrets = shared.sidecar.secrets.filter((s: any) => s.filePath && s.name);
        volumes.push(...sidecarFileSecrets.map((s: any) => ({
            name: `${trimExtension(s.name!)}-sidecar-file-secrets`,
            secret: {
                secretName: `${container.name}-secrets`,
                items: [
                    {
                        key: `${trimExtension(s.name!)}-file-secrets`,
                        path: s.name!,
                    },
                ],
            },
        })));
    }

    // Add persistent volumes
    if (persistentVolumes && persistentVolumes.length > 0) {
        volumes.push(...persistentVolumes.map(volume => ({
            name: volume.name,
            persistentVolumeClaim: {
                claimName: `${container.name}-${volume.name}`,
            },
        })));
    }

    if (volumes.length > 0) {
        podSpec.spec.volumes = volumes;
    }

    return podSpec;
}

function createDeployment(appName: string, group: any, template: any, team: string) {
    const strategy = group.deploymentStrategy || 'RollingUpdate';

    const strategyConfig = strategy === 'RollingUpdate'
        ? {
            type: 'RollingUpdate',
            rollingUpdate: { maxSurge: '25%', maxUnavailable: 0 },
        }
        : {
            type: 'Recreate',
        };

    return {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: group.name, namespace: 'default' },
        spec: {
            replicas: group.replicas,
            strategy: strategyConfig,
            selector: { matchLabels: { app: appName, replicaGroup: group.name } },
            template,
        },
    };
}

function createPVC(appName: string, groupName: string, volume: any) {
    return {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: {
            name: `${groupName}-${volume.name}`,
            namespace: 'default',
            labels: {
                app: appName,
                replicaGroup: groupName,
            },
        },
        spec: {
            accessModes: [volume.accessMode],
            resources: {
                requests: {
                    storage: volume.size,
                },
            },
            ...(volume.storageClass && { storageClassName: volume.storageClass }),
        },
    };
}

function createService(appName: string, replicaGroupName: string, ports: number[]) {
    return {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name: appName, namespace: "default" },
        spec: {
            type: 'ClusterIP',
            selector: { app: replicaGroupName },
            ports: ports.map(port => ({ name: String(port), port, targetPort: port })),
        },
    };
}

function createIngress(appName: string, env: string, shared: any, isSubDomain: boolean, isSubdomainCreated: boolean, ingressDomain: string) {
    let baseHost = [`${env}.${ingressDomain}`];
    let subHost = [`${appName}.${env}.${ingressDomain}`];
    let baseRule = [
        {
            host: `${env}.${ingressDomain}`,
            http: {
                paths: [{
                    path: `/${appName}(/|$)(.*)`,
                    pathType: "ImplementationSpecific",
                    backend: {
                        service: {
                            name: appName,
                            port: { number: shared.ports[0] },
                        },
                    },
                }],
            },
        }
    ]
    let subRules: any[] = [
        {
            host: `${appName}.${env}.${ingressDomain}`,
            http: {
                paths: [{
                    path: `/`,
                    pathType: "Prefix",
                    backend: {
                        service: {
                            name: appName,
                            port: { number: shared.ports[0] },
                        },
                    },
                }],
            },
        }
    ];
    if (env === 'prod') {
        subHost.push(`${appName}.${ingressDomain}`);
        subRules.push({
            host: `${appName}.${ingressDomain}`,
            http: {
                paths: [{
                    path: `/`,
                    pathType: "Prefix",
                    backend: {
                        service: {
                            name: appName,
                            port: { number: shared.ports[0] },
                        },
                    },
                }],
            },
        });
    }

    let finalHost = isSubdomainCreated ? [...subHost, ...baseHost] : [...baseHost];
    let tls = [{
        hosts: [...finalHost],
        secretName: `${appName}-tls`,
    }];

    return {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
            name: `${appName}-${isSubDomain ? 'subdomain' : 'path'}-ingress`,
            namespace: "default",
            annotations: {
                "kubernetes.io/ingress.class": "nginx",
                "cert-manager.io/cluster-issuer": "letsencrypt-prod",
                ...(isSubDomain ? {} : { "nginx.ingress.kubernetes.io/rewrite-target": "/$2" }),
            },
        },
        spec: {
            tls,
            rules: isSubDomain ? subRules : baseRule,
        }
    };
}

function createHPA(appName: string, group: any, env: string) {
    const metrics = [];

    if (group.autoscaling?.targetCPUUtilizationPercentage) {
        metrics.push({
            type: 'Resource',
            resource: {
                name: 'cpu',
                target: {
                    type: 'Utilization',
                    averageUtilization: group.autoscaling.targetCPUUtilizationPercentage,
                },
            },
        });
    }

    if (group.autoscaling?.targetMemoryUtilizationPercentage) {
        metrics.push({
            type: 'Resource',
            resource: {
                name: 'memory',
                target: {
                    type: 'Utilization',
                    averageUtilization: group.autoscaling.targetMemoryUtilizationPercentage,
                },
            },
        });
    }

    return {
        apiVersion: 'autoscaling/v2',
        kind: 'HorizontalPodAutoscaler',
        metadata: {
            name: `${group.name}-hpa`,
            namespace: 'default',
        },
        spec: {
            scaleTargetRef: {
                apiVersion: 'apps/v1',
                kind: 'Deployment',
                name: group.name,
            },
            minReplicas: group.autoscaling.minReplicas,
            maxReplicas: group.autoscaling.maxReplicas,
            metrics,
        },
    };
}

function generateAllDeployments(config: z.infer<typeof AppSchema> & { type: 'deployment' }, env: string, buildDir: string, secrets: Record<string, string>, ingressDomain: string) {
    type AppConfig = z.infer<typeof AppSchema>;
    type EnvKey = keyof Pick<AppConfig, 'stage' | 'prod'>;
    const envConfig = config[env as EnvKey];
    if (!envConfig) {
        return; // Skip if environment is not defined
    }
    const { replicaGroups, shared } = envConfig;
    const outDir = path.join(buildDir, config.name, env);
    fs.mkdirSync(outDir, { recursive: true });

    if (!shared.imagePath && !shared.imageTag) {
        console.error(`❌ Image path and tag are not set for ${config.name} in ${env} environment`);
        console.error(`❌ Please set the image path or tag for ${config.name} in ${env} environment`);
        process.exit(1);
    }

    validateUniqueReplicaGroupNames(envConfig, env, config.name);

    replicaGroups.forEach(group => {
        const labels = {
            app: config.name,
            replicaGroup: group.name,
            team: config.team,
        };

        // Combine main container secrets with sidecar secrets
        const allSecrets = [...group.secrets];
        if (shared.sidecar?.enabled && shared.sidecar.secrets) {
            allSecrets.push(...shared.sidecar.secrets);
        }

        const secretManifest = createSecretManifest({
            appName: config.name,
            name: group.name,
            secrets: allSecrets,
            secretsForEnv: secrets,
            env,
            labels: { replicaGroup: group.name },
        });
        fs.writeFileSync(path.join(outDir, `${group.name}.secret.yaml`), yaml.dump(secretManifest), 'utf8');

        // Split secrets
        const envVarSecrets = group.secrets.filter(s => s.envVar);
        const fileSecrets = group.secrets.filter(s => s.filePath && s.name);

        // Generate PVCs for persistent volumes
        if (group.persistentVolumes && group.persistentVolumes.length > 0) {
            group.persistentVolumes.forEach(volume => {
                const pvc = createPVC(config.name, group.name, volume);
                fs.writeFileSync(path.join(outDir, `${group.name}-${volume.name}.pvc.yaml`), yaml.dump(pvc), 'utf8');
            });
        }

        const container = createContainer({
            name: group.name,
            appName: config.name,
            imageTag: shared.imageTag,
            imagePath: shared.imagePath,
            secrets: envVarSecrets,
            command: shared.command,
            args: shared.args,
            env: group.env,
            resources: group.resources,
            ports: shared.ports,
            livenessProbe: shared.livenessProbe,
            readinessProbe: shared.readinessProbe,
            startupProbe: shared.startupProbe,
            fileSecrets,
            persistentVolumes: group.persistentVolumes,
        });
        const podTemplate = createPodTemplate(labels, container, shared, fileSecrets, group.persistentVolumes);
        const deployment = createDeployment(config.name, group, podTemplate, config.team);
        fs.writeFileSync(path.join(outDir, `${group.name}.deployment.yaml`), yaml.dump(deployment), 'utf8');

        // Generate HPA if autoscaling is enabled
        if (group.autoscaling?.enabled) {
            const hpa = createHPA(config.name, group, env);
            fs.writeFileSync(path.join(outDir, `${group.name}.hpa.yaml`), yaml.dump(hpa), 'utf8');
        }
    });

    const service = createService(config.name, replicaGroups[0].name, shared.ports);
    fs.writeFileSync(path.join(outDir, `service.yaml`), yaml.dump(service), 'utf8');

    if (shared.ingress?.enabled) {
        const ingress = createIngress(config.name, env, shared, false, shared.ingress.subDomainCreated, ingressDomain);
        fs.writeFileSync(path.join(outDir, `path.ingress.yaml`), yaml.dump(ingress), 'utf8');

        if (shared.ingress.subDomainCreated) {
            const cnameIngress = createIngress(config.name, env, shared, true, shared.ingress.subDomainCreated, ingressDomain);
            fs.writeFileSync(path.join(outDir, `cname.ingress.yaml`), yaml.dump(cnameIngress), 'utf8');
        }
    }
}

function generateAllCronJobs(config: z.infer<typeof AppSchema> & { type: 'cronjob' }, env: 'stage' | 'prod', buildDir: string, secrets: Record<string, string>) {
    const envConfig = config[env];
    if (!envConfig?.cronjob) {
        return; // Skip if environment or cronjob is not defined
    }
    const cronConfig = envConfig.cronjob;
    const outDir = path.join(buildDir, config.name, env);
    fs.mkdirSync(outDir, { recursive: true });

    const jobName = config.name;
    const labels = {
        app: jobName,
        team: config.team,
    };

    // ✅ Use shared secret generator
    const secretManifest = createSecretManifest({
        appName: config.name,
        name: jobName,
        secrets: cronConfig.secrets || [],
        secretsForEnv: secrets,
        env,
    });

    fs.writeFileSync(path.join(outDir, `${jobName}.secret.yaml`), yaml.dump(secretManifest), 'utf8');

    const container = createContainer({
        name: jobName,
        appName: config.name,
        imageTag: cronConfig.imageTag,
        imagePath: cronConfig.imagePath,
        command: cronConfig.command,
        args: cronConfig.args,
        secrets: (cronConfig.secrets || []).filter(s => s.envVar),
        fileSecrets: (cronConfig.secrets || []).filter(s => s.filePath && s.name),
        env: cronConfig.env,
        resources: cronConfig.resources,
    });

    const cronJobManifest = {
        apiVersion: 'batch/v1',
        kind: 'CronJob',
        metadata: {
            name: jobName,
            namespace: 'default',
            labels: {
                app: jobName,
                team: config.team,
            },
        },
        spec: {
            schedule: cronConfig.schedule,
            concurrencyPolicy: cronConfig.concurrencyPolicy,
            successfulJobsHistoryLimit: cronConfig.successfulJobsHistoryLimit ?? 3,
            failedJobsHistoryLimit: cronConfig.failedJobsHistoryLimit ?? 1,
            startingDeadlineSeconds: cronConfig.startingDeadlineSeconds,
            suspend: cronConfig.suspend ?? false,
            jobTemplate: {
                spec: {
                    backoffLimit: cronConfig.backoffLimit ?? 1,
                    ttlSecondsAfterFinished: cronConfig.ttlSecondsAfterFinished ?? 172800,
                    template: {
                        metadata: {
                            labels,
                            annotations: {
                                'rollout-trigger': new Date().toISOString(),
                                "prometheus.io/scrape": "true",
                                "prometheus.io/port": "9000",
                                "prometheus.io/path": "/metrics",
                            },
                        },
                        spec: {
                            restartPolicy: 'OnFailure',
                            containers: [container],
                            tolerations: [{
                                key: "workload-type",
                                operator: "Equal",
                                value: cronConfig.workflow,
                                effect: "NoSchedule",
                            }],
                            nodeSelector: { "node-pool": cronConfig.workflow },
                            ...(container.volumeMounts && container.volumeMounts.length > 0
                                ? {
                                    // @ts-ignore
                                    volumes: container.volumeMounts.map(vm => {
                                        const subPath = vm.subPath; // e.g. config.json
                                        const trimmedName = trimExtension(subPath);
                                        return {
                                            name: vm.name, // already includes -file-secrets
                                            secret: {
                                                secretName: `${container.name}-secrets`,
                                                items: [
                                                    {
                                                        key: `${trimmedName}-file-secrets`, // secret key
                                                        path: subPath, // file name in volume
                                                    },
                                                ],
                                            },
                                        };
                                    }),
                                }
                                : {}),
                        },
                    },
                },
            },
        },
    };

    fs.writeFileSync(path.join(outDir, `${jobName}.cronjob.yaml`), yaml.dump(cronJobManifest), 'utf8');
}

interface BuildOptions {
    configPath: string;
    appName?: string; // undefined means build all apps
    buildDir: string;
    secretsDir?: string; // optional secrets directory, if not provided no secrets will be used
    secretIntegrator?: SecretIntegrator; // optional secret integrator, defaults to SOPS
    ingressDomain?: string; // optional ingress domain, defaults to mrgn.app
}

export async function build(options: BuildOptions) {
    const { configPath, appName, buildDir, secretsDir, secretIntegrator = defaultSecretIntegrator, ingressDomain = 'mrgn.app' } = options;

    let appsToBuild: string[];

    if (appName) {
        // Build specific app
        appsToBuild = [`${appName}.json`];
    } else {
        // Build all apps
        appsToBuild = fs.readdirSync(configPath).filter(f => f.endsWith('.json'));
    }

    if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true, force: true });
    fs.mkdirSync(buildDir, { recursive: true });

    // Decrypt secrets once at the start (only if secrets directory is provided)
    const stageSecrets = secretsDir ? loadDecryptedSecrets('stage', secretsDir, secretIntegrator) : {};
    const prodSecrets = secretsDir ? loadDecryptedSecrets('prod', secretsDir, secretIntegrator) : {};

    for (const file of appsToBuild) {
        const raw = fs.readFileSync(path.join(configPath, file), 'utf8');
        const parsed = AppSchema.safeParse(JSON.parse(raw));
        const appKey = path.basename(file, '.json');
        if (!parsed.success) {
            console.error(`Invalid config for ${appKey}:`, JSON.stringify(parsed.error.format(), null, 2));
            process.exit(1);
        }
        const config = parsed.data;

        // Generate for all defined environments
        if (config.type === 'deployment') {
            if (config.stage) {
                generateAllDeployments(config, 'stage', buildDir, stageSecrets, ingressDomain);
            }
            if (config.prod) {
                generateAllDeployments(config, 'prod', buildDir, prodSecrets, ingressDomain);
            }
        } else if (config.type === 'cronjob') {
            if (config.stage) {
                generateAllCronJobs(config, 'stage', buildDir, stageSecrets);
            }
            if (config.prod) {
                generateAllCronJobs(config, 'prod', buildDir, prodSecrets);
            }
        }
    }
}