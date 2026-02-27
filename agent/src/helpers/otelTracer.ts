import { trace, Tracer } from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  BatchSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVICE_NAME,
} from '@opentelemetry/semantic-conventions';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
import { AIProjectClient } from '@azure/ai-projects';
import { TokenCredential } from '@azure/identity';

export class OtelAgentTracer {
  private tracerInstance: Tracer | null = null;
  private tracerPromise: Promise<Tracer> | null = null;
  private readonly serviceName: string;
  private readonly projectEndpoint: string;
  private readonly credential: TokenCredential;

  /**
   * Creates a new OtelAgentTracer instance with the required configuration.
   * 
   * @param serviceName - The name of the service for tracing
   * @param projectEndpoint - The AI Foundry project endpoint URL
   * @param credential - Azure credential for authentication
   */
  constructor(serviceName: string, projectEndpoint: string, credential: TokenCredential) {
    this.serviceName = serviceName;
    this.projectEndpoint = projectEndpoint;
    this.credential = credential;
  }

  /**
   * Gets the tracer instance. On first call, retrieves connection string from AI Foundry
   * and initializes the tracer. Subsequent calls return the cached tracer instance.
   * 
   * @returns Promise resolving to the Tracer instance
   * @throws Error if unable to retrieve connection string or initialize tracer
   */
  public async getTracer(): Promise<Tracer> {
    // If tracer is already initialized, return it immediately
    if (this.tracerInstance) {
      return this.tracerInstance;
    }

    // If tracer initialization is in progress, wait for it
    if (this.tracerPromise) {
      return this.tracerPromise;
    }

    // Start tracer initialization
    this.tracerPromise = this.initializeTracer();
    
    try {
      this.tracerInstance = await this.tracerPromise;
      return this.tracerInstance;
    } catch (error) {
      // Reset promise on failure to allow retry
      this.tracerPromise = null;
      throw error;
    }
  }

  /**
   * Initializes the tracer by retrieving the Application Insights connection string
   * from AI Foundry and setting up OpenTelemetry tracing.
   * 
   * @returns Promise resolving to the initialized Tracer instance
   * @throws Error if unable to retrieve connection string from AI Foundry
   */
  private async initializeTracer(): Promise<Tracer> {
    try {
      const project = new AIProjectClient(this.projectEndpoint, this.credential);
      const connectionString = await project.telemetry.getApplicationInsightsConnectionString();
      
      if (!connectionString) {
        throw new Error('Failed to retrieve Application Insights connection string from AI Foundry');
      }
      
      const azureTraceExporter = new AzureMonitorTraceExporter({ 
        connectionString: connectionString
      });
      
      const provider = new NodeTracerProvider({
        resource: resourceFromAttributes({
          [ATTR_SERVICE_NAME]: this.serviceName,
        }),
        spanProcessors: [
          new BatchSpanProcessor(azureTraceExporter)
        ],
      });
      registerInstrumentations({
        tracerProvider: provider
      });

      // Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
      provider.register();

      return trace.getTracer(this.serviceName);

    } catch (error) {
      console.error('Failed to initialize tracer from AI Foundry project:', error);
      throw new Error(`Tracer initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Resets the tracer instance. Useful for testing or when re-initialization is needed.
   * WARNING: This will clear the cached tracer and force re-initialization on next getTracer() call.
   */
  public reset(): void {
    this.tracerInstance = null;
    this.tracerPromise = null;
  }
}

