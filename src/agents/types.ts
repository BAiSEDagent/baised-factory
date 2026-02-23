/**
 * BAiSED Factory Factory - Types
 */

export interface Agent {
  name: string;
  execute?: (task: Task) => Promise<Result>;
}

export interface Task {
  id: string;
  type: string;
  description: string;
  critical?: boolean;
  data?: any;
}

export interface Result {
  success: boolean;
  data?: any;
  logs?: string[];
  error?: string;
}

export interface QualityGate {
  name: string;
  checks: Check[];
}

export interface Check {
  description: string;
  validator: (input: any) => Promise<boolean>;
}

export interface Pipeline {
  name: string;
  stages: Stage[];
}

export interface Stage {
  name: string;
  agent: string;
  gates: QualityGate[];
}