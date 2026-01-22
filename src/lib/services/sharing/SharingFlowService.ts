import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

interface SharingFlow {
  id: string;
  name: string;
  description?: string;
  steps: SharingStep[];
}

interface SharingStep {
  id: string;
  type: 'form' | 'confirmation' | 'share';
  fields?: FormField[];
  title: string;
  description?: string;
  actions?: SharingAction[];
}

interface FormField {
  id: string;
  type: 'text' | 'select' | 'datetime' | 'number' | 'toggle';
  label: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  default?: unknown;
}

interface SharingAction {
  id: string;
  type: 'button' | 'submit' | 'link';
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive';
  action: string;
}

export class SharingFlowService {
  private flows: Map<string, SharingFlow> = new Map();
  private static instance: SharingFlowService;

  private constructor() {
    this.loadFlows();
  }

  public static getInstance(): SharingFlowService {
    if (!SharingFlowService.instance) {
      SharingFlowService.instance = new SharingFlowService();
    }
    return SharingFlowService.instance;
  }

  private loadFlows() {
    try {
      const flowsDir = path.join(process.cwd(), 'flows');
      const flowFiles = fs.readdirSync(flowsDir);
      
      for (const file of flowFiles) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const flowContent = fs.readFileSync(path.join(flowsDir, file), 'utf8');
          const flowData = yaml.load(flowContent) as SharingFlow;
          
          if (flowData && flowData.id) {
            this.flows.set(flowData.id, flowData);
          }
        }
      }
    } catch (error) {
      console.error('Error loading sharing flows:', error);
    }
  }

  public getFlow(flowId: string): SharingFlow | undefined {
    return this.flows.get(flowId);
  }

  public getAllFlows(): SharingFlow[] {
    return Array.from(this.flows.values());
  }

  public async executeStep(flowId: string, stepId: string, data: Record<string, unknown>) {
    const flow = this.getFlow(flowId);
    if (!flow) {
      throw new Error(`Flow ${flowId} not found`);
    }

    const step = flow.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in flow ${flowId}`);
    }

    // Here we would implement the actual step execution logic
    // based on the step type and configuration
    return {
      success: true,
      nextStep: this.getNextStep(flow, stepId, data),
      data
    };
  }

  private getNextStep(flow: SharingFlow, currentStepId: string, _data: unknown): string | null {
    const currentIndex = flow.steps.findIndex(step => step.id === currentStepId);
    if (currentIndex === -1 || currentIndex === flow.steps.length - 1) {
      return null;
    }
    return flow.steps[currentIndex + 1].id;
  }
}
