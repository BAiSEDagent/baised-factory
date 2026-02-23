/**
 * BAiSED Factory Factory - Usage Example
 */

import { BAiSED FactoryFactory } from './index';

async function main() {
  // Initialize factory
  const factory = new BAiSED FactoryFactory();
  await factory.initialize();
  
  console.log('BAiSED Factory Factory Example\n');
  
  // Example 1: Build a feature
  const result = await factory.execute({
    id: 'feature-001',
    type: 'feature',
    description: 'Add user authentication with JWT tokens',
    data: {
      requirements: [
        'OAuth2 login with Google',
        'JWT token generation',
        'Session management',
        'Protected routes'
      ]
    },
    critical: true,
  });
  
  console.log('\n=== Result ===');
  console.log('Success:', result.success);
  if (result.data) {
    console.log('Pipeline ID:', result.data.pipelineId);
    console.log('Stages completed:', result.data.stages.length);
  }
  if (result.error) {
    console.log('Error:', result.error);
  }
  
  // Get status
  const status = await factory.getStatus();
  console.log('\n=== Factory Status ===');
  console.log('Running pipelines:', status.runningPipelines);
  console.log('Recent failures:', status.recentFailures);
}

main().catch(console.error);