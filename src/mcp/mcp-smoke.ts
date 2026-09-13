import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', join(here, 'stdio-server.ts')],
    env: {
      ...process.env,
      OFFICE_USER_ID: 'adv-ana',
      OFFICE_ROLE: 'advogado',
    },
  });
  const client = new Client({ name: 'office-smoke', version: '0.1.0' });
  await client.connect(transport);

  const listed = await client.listTools();
  console.log(
    'tools/list=',
    JSON.stringify(listed.tools.map((t) => t.name)),
  );
  if (!listed.tools.every((t) => t.outputSchema && t.outputSchema.type === 'object')) {
    throw new Error('smoke_missing_output_schema');
  }
  console.log('tools/list outputSchema=SafeDTO');

  const entered = await client.callTool({
    name: 'enter_office',
    arguments: { caseId: 'case-banco-001' },
  });
  const enterText = JSON.stringify(entered);
  console.log('tools/call enter_office=', enterText);

  const sessionMatch = enterText.match(/"sessionId":"(ofs_[^"]+)"/);
  if (!sessionMatch) {
    throw new Error('smoke_missing_session');
  }
  const summary = await client.callTool({
    name: 'get_safe_summary',
    arguments: { sessionId: sessionMatch[1] },
  });
  console.log('tools/call get_safe_summary=', JSON.stringify(summary));

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
