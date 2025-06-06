/*
 * Copyright 2022 The Backstage Authors
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

import crypto from 'crypto';
import { InputError } from '@backstage/errors';
import { Config } from '@backstage/config';
import {
  GerritIntegrationConfig,
  getGerritRequestOptions,
  ScmIntegrationRegistry,
} from '@backstage/integration';
import {
  createTemplateAction,
  getRepoSourceDirectory,
  initRepoAndPush,
  parseRepoUrl,
} from '@backstage/plugin-scaffolder-node';
import { examples } from './gerrit.examples';

const createGerritProject = async (
  config: GerritIntegrationConfig,
  options: {
    projectName: string;
    parent: string;
    owner?: string;
    description: string;
    defaultBranch: string;
  },
): Promise<void> => {
  const { projectName, parent, owner, description, defaultBranch } = options;

  const fetchOptions: RequestInit = {
    method: 'PUT',
    body: JSON.stringify({
      parent,
      description,
      branches: [defaultBranch],
      owners: owner ? [owner] : [],
      create_empty_commit: false,
    }),
    headers: {
      ...getGerritRequestOptions(config).headers,
      'Content-Type': 'application/json',
    },
  };
  const response: Response = await fetch(
    `${config.baseUrl}/a/projects/${encodeURIComponent(projectName)}`,
    fetchOptions,
  );
  if (response.status !== 201) {
    throw new Error(
      `Unable to create repository, ${response.status} ${
        response.statusText
      }, ${await response.text()}`,
    );
  }
};

const generateCommitMessage = (
  config: Config,
  commitSubject?: string,
): string => {
  const changeId = crypto.randomBytes(20).toString('hex');
  const msg = `${
    config.getOptionalString('scaffolder.defaultCommitMessage') || commitSubject
  }\n\nChange-Id: I${changeId}`;
  return msg;
};

/**
 * Creates a new action that initializes a git repository of the content in the workspace
 * and publishes it to a Gerrit instance.
 * @public
 */
export function createPublishGerritAction(options: {
  integrations: ScmIntegrationRegistry;
  config: Config;
}) {
  const { integrations, config } = options;

  return createTemplateAction({
    id: 'publish:gerrit',
    supportsDryRun: true,
    description:
      'Initializes a git repository of the content in the workspace, and publishes it to Gerrit.',
    examples,
    schema: {
      input: {
        repoUrl: z =>
          z.string({
            description: 'Repository Location',
          }),
        description: z =>
          z.string({
            description: 'Repository Description',
          }),
        defaultBranch: z =>
          z
            .string({
              description: `Sets the default branch on the repository. The default value is 'master'`,
            })
            .optional(),
        gitCommitMessage: z =>
          z
            .string({
              description: `Sets the commit message on the repository. The default value is 'initial commit'`,
            })
            .optional(),
        gitAuthorName: z =>
          z
            .string({
              description: `Sets the default author name for the commit. The default value is 'Scaffolder'`,
            })
            .optional(),
        gitAuthorEmail: z =>
          z
            .string({
              description: `Sets the default author email for the commit.`,
            })
            .optional(),
        sourcePath: z =>
          z
            .string({
              description: `Path within the workspace that will be used as the repository root. If omitted, the entire workspace will be published as the repository.`,
            })
            .optional(),
        signCommit: z =>
          z
            .boolean({
              description: 'Sign commit with configured PGP private key',
            })
            .optional(),
      },
      output: {
        remoteUrl: z =>
          z
            .string({
              description: 'A URL to the repository with the provider',
            })
            .optional(),
        repoContentsUrl: z =>
          z
            .string({
              description: 'A URL to the root of the repository',
            })
            .optional(),
        commitHash: z =>
          z
            .string({
              description: 'The git commit hash of the initial commit',
            })
            .optional(),
      },
    },
    async handler(ctx) {
      const {
        repoUrl,
        description,
        defaultBranch = 'master',
        gitAuthorName,
        gitAuthorEmail,
        gitCommitMessage = 'initial commit',
        sourcePath,
        signCommit,
      } = ctx.input;
      const { repo, host, owner, workspace } = parseRepoUrl(
        repoUrl,
        integrations,
      );

      const integrationConfig = integrations.gerrit.byHost(host);

      if (!integrationConfig) {
        throw new InputError(
          `No matching integration configuration for host ${host}, please check your integrations config`,
        );
      }

      if (!workspace) {
        throw new InputError(
          `Invalid URL provider was included in the repo URL to create ${ctx.input.repoUrl}, missing workspace`,
        );
      }

      const repoContentsUrl = `${integrationConfig.config.gitilesBaseUrl}/${repo}/+/refs/heads/${defaultBranch}`;
      const remoteUrl = `${integrationConfig.config.cloneUrl}/a/${repo}`;
      const gitName = gitAuthorName
        ? gitAuthorName
        : config.getOptionalString('scaffolder.defaultAuthor.name');
      const gitEmail = gitAuthorEmail
        ? gitAuthorEmail
        : config.getOptionalString('scaffolder.defaultAuthor.email');
      const commitMessage = generateCommitMessage(config, gitCommitMessage);

      if (ctx.isDryRun) {
        ctx.logger.info(
          `Dry run arguments: ${{
            gitName,
            gitEmail,
            commitMessage,
            ...ctx.input,
          }}`,
        );
        ctx.output('remoteUrl', remoteUrl);
        ctx.output('commitHash', 'abcd-dry-run-1234');
        ctx.output('repoContentsUrl', repoContentsUrl);
        return;
      }

      await createGerritProject(integrationConfig.config, {
        description,
        owner: owner,
        projectName: repo,
        parent: workspace,
        defaultBranch,
      });
      const auth = {
        username: integrationConfig.config.username!,
        password: integrationConfig.config.password!,
      };
      const gitAuthorInfo = {
        name: gitName,
        email: gitEmail,
      };

      const signingKey =
        integrationConfig.config.commitSigningKey ??
        config.getOptionalString('scaffolder.defaultCommitSigningKey');
      if (signCommit && !signingKey) {
        throw new Error(
          'Signing commits is enabled but no signing key is provided in the configuration',
        );
      }

      const commitResult = await initRepoAndPush({
        dir: getRepoSourceDirectory(ctx.workspacePath, sourcePath),
        remoteUrl,
        auth,
        defaultBranch,
        logger: ctx.logger,
        commitMessage: generateCommitMessage(config, gitCommitMessage),
        gitAuthorInfo,
        signingKey: signCommit ? signingKey : undefined,
      });

      ctx.output('remoteUrl', remoteUrl);
      ctx.output('commitHash', commitResult?.commitHash);
      ctx.output('repoContentsUrl', repoContentsUrl);
    },
  });
}
