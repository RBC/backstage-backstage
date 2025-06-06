/*
 * Copyright 2023 The Backstage Authors
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

import { Link } from '@backstage/core-components';
import {
  createFrontendPlugin,
  createRouteRef,
  createExternalRouteRef,
  useRouteRef,
  PageBlueprint,
  FrontendPluginInfo,
  useAppNode,
} from '@backstage/frontend-plugin-api';
import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';

const indexRouteRef = createRouteRef();
const page1RouteRef = createRouteRef();
export const externalPageXRouteRef = createExternalRouteRef({
  defaultTarget: 'pages.pageX',
});
export const pageXRouteRef = createRouteRef();
// const page2RouteRef = createSubRouteRef({
//   id: 'page2',
//   parent: page1RouteRef,
//   path: '/page2',
// });

function PluginInfo() {
  const node = useAppNode();
  const [info, setInfo] = useState<FrontendPluginInfo | undefined>(undefined);

  useEffect(() => {
    node?.spec.source?.info().then(setInfo);
  }, [node]);

  return (
    <div>
      <h3>Plugin Info</h3>
      <pre>{JSON.stringify(info, null, 2)}</pre>
    </div>
  );
}

const IndexPage = PageBlueprint.make({
  name: 'index',
  params: {
    defaultPath: '/',
    routeRef: indexRouteRef,
    loader: async () => {
      const Component = () => {
        const page1Link = useRouteRef(page1RouteRef);
        return (
          <div>
            op
            {page1Link && (
              <div>
                <Link to={page1Link()}>Page 1</Link>
              </div>
            )}
            <div>
              <Link to="/home">Home</Link>
            </div>
            <div>
              <Link to="/graphiql">GraphiQL</Link>
            </div>
            <div>
              <Link to="/search">Search</Link>
            </div>
            <div>
              <Link to="/settings">Settings</Link>
            </div>
            <PluginInfo />
          </div>
        );
      };
      return <Component />;
    },
  },
});

const Page1 = PageBlueprint.make({
  name: 'page1',
  params: {
    defaultPath: '/page1',
    routeRef: page1RouteRef,
    loader: async () => {
      const Component = () => {
        const indexLink = useRouteRef(indexRouteRef);
        const xLink = useRouteRef(externalPageXRouteRef);
        // const page2Link = useRouteRef(page2RouteRef);

        return (
          <div>
            <h1>This is page 1</h1>
            {indexLink && <Link to={indexLink()}>Go back</Link>}
            <Link to="./page2">Page 2</Link>
            {/* <Link to={page2Link()}>Page 2</Link> */}
            {xLink && <Link to={xLink()}>Page X</Link>}

            <div>
              Sub-page content:
              <div>
                <Routes>
                  <Route path="/" element={<h2>This is also page 1</h2>} />
                  <Route path="/page2" element={<h2>This is page 2</h2>} />
                </Routes>
              </div>
            </div>
          </div>
        );
      };
      return <Component />;
    },
  },
});

const ExternalPage = PageBlueprint.make({
  name: 'pageX',
  params: {
    defaultPath: '/pageX',
    routeRef: pageXRouteRef,
    loader: async () => {
      const Component = () => {
        const indexLink = useRouteRef(indexRouteRef);
        // const pageXLink = useRouteRef(pageXRouteRef);

        return (
          <div>
            <h1>This is page X</h1>
            {indexLink && <Link to={indexLink()}>Go back</Link>}
          </div>
        );
      };
      return <Component />;
    },
  },
});

export const pagesPlugin = createFrontendPlugin({
  pluginId: 'pages',
  // routes: {
  //   index: indexRouteRef,
  //   // reference in config:
  //   //   'plugin.pages.routes.index'
  //   //     OR
  //   //   'page1'
  // },
  info: {
    packageJson: () => import('../../package.json'),
    manifest: () => import('../../catalog-info.yaml'),
  },
  routes: {
    page1: page1RouteRef,
    pageX: pageXRouteRef,
  },
  externalRoutes: {
    pageX: externalPageXRouteRef,
  },
  extensions: [IndexPage, Page1, ExternalPage],
});
