## API Report File for "@backstage/plugin-scaffolder-backend-module-yeoman"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts
import { BackendFeature } from '@backstage/backend-plugin-api';
import { TemplateAction } from '@backstage/plugin-scaffolder-node';

// @public
export function createRunYeomanAction(): TemplateAction<
  {
    namespace: string;
    args?: string[] | undefined;
    options?: Record<string, any> | undefined;
  },
  {
    [x: string]: any;
  },
  'v2'
>;

// @public
const yeomanModule: BackendFeature;
export default yeomanModule;
```
