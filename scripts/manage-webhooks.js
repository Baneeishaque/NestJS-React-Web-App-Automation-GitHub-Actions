// scripts/manage-webhooks.js
import { request } from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load dotenv - exit if not available
try {
  const { config } = await import('dotenv');
  // Load environment variables from .env file in the scripts folder
  config({ path: join(__dirname, '.env') });
  console.log('✅ Loaded environment variables from .env file');
} catch (error) {
  console.error('❌ Failed to load dotenv:', error.message);
  console.error('Please install dotenv: npm install dotenv');
  process.exit(1);
}

// Get configuration from environment variables (with .env support)
const GITHUB_TOKEN = process.env.OWNER_GITHUB_TOKEN;
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const WEBHOOK_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/github-webhook`;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Repositories to manage webhooks for
const repositories = process.env.REPOSITORIES
  ? process.env.REPOSITORIES.split(',').map(repo => repo.trim())
  : [];

if (repositories.length === 0) {
  console.error('❌ No repositories found in REPOSITORIES environment variable.');
  console.error('Please add a comma-separated list of repositories to your .env file.');
  process.exit(1);
}

// Helper function for GitHub API requests
function githubRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'User-Agent': 'GitHub-Webhook-Manager',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };

    if (data) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(responseData ? JSON.parse(responseData) : {});
          } catch (e) {
            resolve(responseData);
          }
        } else {
          console.error(`Error response: ${res.statusCode}`);
          console.error(responseData);
          reject(new Error(`Request failed with status ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Check existing webhooks and create if needed
async function manageWebhooks() {
  for (const repo of repositories) {
    console.log(`\n=== Checking webhooks for ${repo} ===`);

    try {
      // Get existing webhooks
      const hooks = await githubRequest('GET', `/repos/${repo}/hooks`);

      // Check if our webhook exists
      const existingHook = hooks.find(hook =>
        hook.config && hook.config.url === WEBHOOK_URL
      );

      if (existingHook) {
        console.log(`✅ Webhook already exists for ${repo}`);

        // Check if it has the right events
        const hasRequiredEvents =
          existingHook.events.includes('push') &&
          existingHook.events.includes('pull_request');

        if (!hasRequiredEvents) {
          console.log(`⚠️ Updating events for webhook in ${repo}`);
          await githubRequest('PATCH', `/repos/${repo}/hooks/${existingHook.id}`, {
            events: ['push', 'pull_request']
          });
          console.log(`✅ Updated events for webhook in ${repo}`);
        }

        // Ensure webhook is active
        if (!existingHook.active) {
          console.log(`⚠️ Webhook is inactive for ${repo}, activating...`);
          await githubRequest('PATCH', `/repos/${repo}/hooks/${existingHook.id}`, {
            active: true
          });
          console.log(`✅ Activated webhook for ${repo}`);
        }
      } else {
        console.log(`⚠️ No webhook found for ${repo}, creating...`);

        // Create webhook with proper configuration
        const webhookConfig = {
          name: 'web',
          active: true,
          events: ['push', 'pull_request'],
          config: {
            url: WEBHOOK_URL,
            content_type: 'json',
            insecure_ssl: '0'
          }
        };

        // Add secret if provided
        if (WEBHOOK_SECRET) {
          webhookConfig.config.secret = WEBHOOK_SECRET;
        }

        await githubRequest('POST', `/repos/${repo}/hooks`, webhookConfig);
        console.log(`✅ Created webhook for ${repo}`);
      }
    } catch (error) {
      console.error(`❌ Error managing webhook for ${repo}:`, error.message);
      process.exit(1);
    }
  }

  console.log('\n✅ All webhooks successfully configured!');
}

manageWebhooks().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
