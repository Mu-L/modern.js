import { createBabelChain, BabelChain } from '@modern-js/babel-chain';
import { getBaseBabelChain } from '@modern-js/babel-preset-base';
import { isTest, isDev, isProd } from '@modern-js/utils';
import { isBeyondReact17 } from './utils';
// import { isPnpm } from './utils';
import type { Options, EnvOptions } from './type';

const prepareEnvOptions = (options: Options): EnvOptions => {
  const { useBuiltIns, modules, useModern } = options;

  const envOptions: EnvOptions = {
    useBuiltIns,
    modules,
    exclude: ['transform-typeof-symbol'],
    corejs: useBuiltIns
      ? {
          version: '3',
          proposals: true,
        }
      : undefined,
  };

  if (useModern) {
    envOptions.targets = { esmodules: true };
    envOptions.modules = false;
    envOptions.bugfixes = true;
  }

  return envOptions;
};

export const genCommon = (options: Options): BabelChain => {
  const {
    lodash: lodashOptions,
    target,
    metaName,
    appDirectory,
    useLegacyDecorators,
    modules,
    styledCompontents,
    useTsLoader,
  } = options;

  const useSSR = target === 'server';

  const envOptions = prepareEnvOptions(options);

  const chain = createBabelChain();

  const baseConfigChain = getBaseBabelChain({
    appDirectory,
    useTsLoader,
    runEnvironments: isTest() || target === 'server' ? 'node' : 'browsers',
    // https://babeljs.io/docs/en/babel-preset-react#runtime
    jsxTransformRuntime: isBeyondReact17(appDirectory)
      ? 'automatic'
      : 'classic',
    presets: {
      // 与内部的preset-env配置合并
      envOptions,
      typescriptOptions: {
        allExtensions: true,
        allowDeclareFields: true,
        isTSX: true,
      },
      reactOptions: {
        // Adds component stack to warning messages
        // Adds __self attribute to JSX which React will use for some warnings
        development: isDev() || isTest(),
        // Will use the native built-in instead of trying to polyfill
        // behavior for any plugins that require one.
        useBuiltIns: true,
        // 原来配置中没有配置这个，默认为false，而 base config里有配置
        useSpread: false,
      },
    },
    plugins: {
      lodashOptions,
      import: { antd: { libraryDirectory: useSSR ? 'lib' : 'es' } },
      transformRuntime: {
        // version, regenerator 在 base config 里已配置
        // https://babeljs.io/docs/en/babel-plugin-transform-runtime#useesmodules
        // We should turn this on once the lowest version of Node LTS
        // supports ES Modules.
        useESModules: !modules,
      },
      transformReactRemovePropTypes: isProd()
        ? {
            // 内部默认 removeImport: true,
          }
        : false,
      styledCompontentsOptions: styledCompontents,
    },
    syntax: 'es5',
    useLegacyDecorators,
  });

  chain
    .plugin('built-in/babel-plugin-lock-corejs-version')
    .use(require.resolve('./built-in/babel-plugin-lock-corejs-version'), [
      { metaName },
    ]);

  // TODO depened on pnpm @modern-cli/dev-utils/monorepo
  // if (isPnpm(appDirectory)) {
  //   chain.plugin(require.resolve('./built-in/babel-plugin-pnpm-adapter'));
  // }

  chain
    .plugin('./built-in/babel-plugin-ssr-loader-id')
    .use(require.resolve('./built-in/babel-plugin-ssr-loader-id'));

  // 该插件 base config里没有，保持不变
  // NOTE: This plugin is included in @babel/preset-env, in ES2020
  // https://babeljs.io/docs/en/babel-plugin-syntax-dynamic-import#docsNav
  chain
    .plugin('@babel/plugin-syntax-dynamic-import')
    .use(require.resolve('@babel/plugin-syntax-dynamic-import'));

  return chain.merge(baseConfigChain);
};
