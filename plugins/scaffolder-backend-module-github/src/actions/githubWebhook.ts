/*
 * Copyright 2021 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  GithubCredentialsProvider,
  ScmIntegrationRegistry,
} from '@backstage/integration';
import {
  createTemplateAction,
  parseRepoUrl,
} from '@backstage/plugin-scaffolder-node';
import { emitterEventNames } from '@octokit/webhooks';
import { assertError, InputError } from '@backstage/errors';
import { Octokit } from 'octokit';
import { getOctokitOptions } from '../util';
import { examples } from './githubWebhook.examples';

/**
 * Creates new action that creates a webhook for a repository on GitHub.
 * @public
 */
export function createGithubWebhookAction(options: {
  integrations: ScmIntegrationRegistry;
  defaultWebhookSecret?: string;
  githubCredentialsProvider?: GithubCredentialsProvider;
}) {
  const { integrations, defaultWebhookSecret, githubCredentialsProvider } =
    options;

  const eventNames = emitterEventNames.filter(event => !event.includes('.'));

  return createTemplateAction({
    id: 'github:webhook',
    description: 'Creates webhook for a repository on GitHub.',
    examples,
    supportsDryRun: true,
    schema: {
      input: {
        repoUrl: z =>
          z.string({
            description:
              'Accepts the format `github.com?repo=reponame&owner=owner` where `reponame` is the new repository name and `owner` is an organization or username',
          }),
        webhookUrl: z =>
          z.string({
            description: 'The URL to which the payloads will be delivered',
          }),
        webhookSecret: z =>
          z
            .string({
              description:
                'Webhook secret value. The default can be provided internally in action creation',
            })
            .optional(),
        events: z =>
          z
            .union([
              z.array(z.enum(eventNames as [string, ...string[]]), {
                description:
                  'Determines what events the hook is triggered for. Default: `[push]`',
              }),
              z.array(z.literal('*'), {
                description:
                  'Determines what events the hook is triggered for. Use "*" for all events. Default: `[push]`',
              }),
            ])
            .default(['push'])
            .optional(),
        active: z =>
          z
            .boolean({
              description:
                'Determines if notifications are sent when the webhook is triggered. Default: `true`',
            })
            .default(true)
            .optional(),
        contentType: z =>
          z
            .enum(['form', 'json'], {
              description:
                'The media type used to serialize the payloads. The default is `form`',
            })
            .default('form')
            .optional(),
        insecureSsl: z =>
          z
            .boolean({
              description:
                'Determines whether the SSL certificate of the host for url will be verified when delivering payloads. Default `false`',
            })
            .default(false)
            .optional(),
        token: z =>
          z
            .string({
              description:
                'The `GITHUB_TOKEN` to use for authorization to GitHub',
            })
            .optional(),
      },
    },
    async handler(ctx) {
      const {
        repoUrl,
        webhookUrl,
        webhookSecret = defaultWebhookSecret,
        events = ['push'],
        active = true,
        contentType = 'form',
        insecureSsl = false,
        token: providedToken,
      } = ctx.input;

      ctx.logger.info(`Creating webhook ${webhookUrl} for repo ${repoUrl}`);
      const { host, owner, repo } = parseRepoUrl(repoUrl, integrations);

      if (!owner) {
        throw new InputError('Invalid repository owner provided in repoUrl');
      }

      const octokitOptions = await getOctokitOptions({
        integrations,
        credentialsProvider: githubCredentialsProvider,
        host,
        owner,
        repo,
        token: providedToken,
      });
      const client = new Octokit({
        ...octokitOptions,
        log: ctx.logger,
      });

      // If this is a dry run, log and return
      if (ctx.isDryRun) {
        ctx.logger.info(`Dry run complete`);
        return;
      }

      try {
        const insecure_ssl = insecureSsl ? '1' : '0';

        await ctx.checkpoint({
          key: `create.webhhook.${owner}.${repo}.${webhookUrl}`,
          fn: async () => {
            await client.rest.repos.createWebhook({
              owner,
              repo,
              config: {
                url: webhookUrl,
                content_type: contentType,
                secret: webhookSecret,
                insecure_ssl,
              },
              events,
              active,
            });
          },
        });

        ctx.logger.info(`Webhook '${webhookUrl}' created successfully`);
      } catch (e) {
        assertError(e);
        ctx.logger.warn(
          `Failed: create webhook '${webhookUrl}' on repo: '${repo}', ${e.message}`,
        );
      }
    },
  });
}
