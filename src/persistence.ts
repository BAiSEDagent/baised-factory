import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

export interface Task {
  id: string;
  pipelineId: string;
  stage: string;
  agent: string;
  description: string;
  type: string;
  critical: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed';
  data: string;
  result?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
  createdAt: number;
}

export interface Pipeline {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  currentStage: string;
  createdAt: number;
  updatedAt: number;
}

export class Persistence {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
  
  async initialize(dbPath: string = '~/.baised/bmad.db'): Promise<void> {
    const resolvedPath = dbPath.replace('~', process.env.HOME || '');
    
    this.db = await open({
      filename: resolvedPath,
      driver: sqlite3.Database,
    });
    
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS pipelines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        current_stage TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        pipeline_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        agent TEXT NOT NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL,
        critical INTEGER NOT NULL,
        status TEXT NOT NULL,
        data TEXT,
        result TEXT,
        error TEXT,
        start_time INTEGER,
        end_time INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_pipeline_status ON pipelines(status);
      CREATE INDEX IF NOT EXISTS idx_task_pipeline ON tasks(pipeline_id);
      CREATE INDEX IF NOT EXISTS idx_task_status ON tasks(status);
    `);
  }
  
  async createPipeline(pipeline: Pipeline): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      `INSERT INTO pipelines (id, name, status, current_stage, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      pipeline.id,
      pipeline.name,
      pipeline.status,
      pipeline.currentStage,
      pipeline.createdAt,
      pipeline.updatedAt
    );
  }
  
  async updatePipeline(id: string, updates: Partial<Pipeline>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    
    await this.db.run(
      `UPDATE pipelines SET ${fields}, updated_at = ? WHERE id = ?`,
      ...values,
      Date.now(),
      id
    );
  }
  
  async createTask(task: Task): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      `INSERT INTO tasks (id, pipeline_id, stage, agent, description, type, critical, status, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      task.id,
      task.pipelineId,
      task.stage,
      task.agent,
      task.description,
      task.type,
      task.critical ? 1 : 0,
      task.status,
      JSON.stringify(task.data),
      task.createdAt
    );
  }
  
  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const mapped: any = {};
    if (updates.status) mapped.status = updates.status;
    if (updates.result) mapped.result = JSON.stringify(updates.result);
    if (updates.error) mapped.error = updates.error;
    if (updates.startTime) mapped.start_time = updates.startTime;
    if (updates.endTime) mapped.end_time = updates.endTime;
    
    const fields = Object.keys(mapped).map(k => `${k} = ?`).join(', ');
    const values = Object.values(mapped);
    
    if (fields.length === 0) return;
    
    await this.db.run(
      `UPDATE tasks SET ${fields} WHERE id = ?`,
      ...values,
      id
    );
  }
  
  async getPipeline(id: string): Promise<Pipeline | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get('SELECT * FROM pipelines WHERE id = ?', id);
  }
  
  async getPipelineTasks(pipelineId: string): Promise<Task[]> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.all('SELECT * FROM tasks WHERE pipeline_id = ? ORDER BY created_at', pipelineId);
  }
  
  async getRunningPipelines(): Promise<Pipeline[]> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.all("SELECT * FROM pipelines WHERE status = 'running' ORDER BY created_at DESC");
  }
  
  async getFailedTasks(since: number = Date.now() - 7 * 24 * 60 * 60 * 1000): Promise<Task[]> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.all(
      "SELECT * FROM tasks WHERE status = 'failed' AND created_at > ? ORDER BY created_at DESC",
      since
    );
  }
}