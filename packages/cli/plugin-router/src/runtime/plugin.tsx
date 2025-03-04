import React, { useContext } from 'react';
import {
  createBrowserHistory,
  createHashHistory,
  History,
  BrowserHistoryBuildOptions,
  HashHistoryBuildOptions,
} from 'history';
import { Router, StaticRouter, RouteProps } from 'react-router-dom';
import { createPlugin, RuntimeReactContext } from '@modern-js/runtime-core';
import hoistNonReactStatics from 'hoist-non-react-statics';
import { BaseSSRServerContext } from '@modern-js/types';
import { renderRoutes, getLocation, urlJoin } from './utils';

declare global {
  interface Window {
    _SERVER_DATA?: {
      router: {
        baseUrl: string;
        params: Record<string, string>;
      };
    };
  }
}

export type SingleRouteConfig = RouteProps & {
  redirect?: string;
  routes?: SingleRouteConfig[];
  key?: string;

  /**
   * layout component
   */
  layout?: React.ComponentType;

  /**
   * component would be rendered when route macthed.
   */
  component?: React.ComponentType;
};

export type HistoryConfig =
  | {
      supportHtml5History: true;
      historyOptions: BrowserHistoryBuildOptions;
    }
  | {
      supportHtml5History: false;
      historyOptions: HashHistoryBuildOptions;
    };

export type RouterConfig = Partial<HistoryConfig> & {
  routesConfig?: {
    globalApp?: React.ComponentType<any>;
    routes?: SingleRouteConfig[];
  };
  history?: History;
  serverBase?: string[];
};

// todo: check
const isBrowser = () => typeof window !== 'undefined';

export const routerPlugin: any = ({
  serverBase = [],
  history: customHistory,
  supportHtml5History = true,
  routesConfig,
  historyOptions = {},
}: RouterConfig) => {
  const isBrow = isBrowser();

  const select = (pathname: string) =>
    serverBase.find(baseUrl => pathname.search(baseUrl) === 0) || '/';

  return createPlugin(
    () => ({
      hoc: ({ App }, next) => {
        const getRouteApp = () => {
          if (isBrow) {
            historyOptions.basename = urlJoin(
              window._SERVER_DATA?.router.baseUrl || select(location.pathname),
              historyOptions.basename as string,
            );

            const history =
              customHistory || supportHtml5History
                ? createBrowserHistory(historyOptions)
                : createHashHistory(historyOptions);

            return (props: any) => (
              <Router history={history}>
                {routesConfig ? (
                  renderRoutes(routesConfig, props)
                ) : (
                  <App {...props} />
                )}
              </Router>
            );
          }

          return (props: any) => {
            const runtimeContext = useContext(RuntimeReactContext);
            const { ssrContext }: { ssrContext?: BaseSSRServerContext } =
              runtimeContext;
            const location = getLocation(ssrContext);
            const routerContext = ssrContext?.redirection || {};
            const request = ssrContext?.request;
            const basename = urlJoin(
              request?.baseUrl as string,
              historyOptions.basename as string,
            );

            return (
              <StaticRouter
                basename={basename}
                location={location}
                context={routerContext}>
                {routesConfig ? (
                  renderRoutes(routesConfig, props)
                ) : (
                  <App {...props} />
                )}
              </StaticRouter>
            );
          };
        };

        return next({
          App: App ? hoistNonReactStatics(getRouteApp(), App) : getRouteApp(),
        });
      },
    }),
    { name: `@modern-js/plugin-router` },
  );
};
