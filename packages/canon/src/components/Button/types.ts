/*
 * Copyright 2024 The Backstage Authors
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

import type { ButtonOwnProps } from './Button.props';
import { ReactElement } from 'react';
import type { useRender } from '@base-ui-components/react/use-render';

/**
 * Properties for {@link Button}
 *
 * @public
 */
export interface ButtonProps extends useRender.ComponentProps<'button'> {
  /**
   * The size of the button
   * @defaultValue 'medium'
   */
  size?: ButtonOwnProps['size'];

  /**
   * The visual variant of the button
   * @defaultValue 'primary'
   */
  variant?: ButtonOwnProps['variant'];

  /**
   * Optional icon to display at the start of the button
   */
  iconStart?: ReactElement;

  /**
   * Optional icon to display at the end of the button
   */
  iconEnd?: ReactElement;
}
