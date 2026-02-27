import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import webpack from "webpack";
import dotenv from "dotenv";

// Load .env values
dotenv.config();

const config: Config = {
  title: 'Whatever AI Assistant Agent',
  tagline: 'Microsoft Agetns League',
  favicon: 'img/favicon.ico',
  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],
  url: process.env.ENV_SiteUrl ? process.env.ENV_SiteUrl : 'http://localhost:3000',
  baseUrl: process.env.ENV_BaseUrl ? process.env.ENV_BaseUrl : '/',
  organizationName: 'contoso',
  projectName: 'whatever-ai-assistant-agent',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: "https://github.com/FranckyC/agents-league-whatever-ai-assistant",
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
          routeBasePath: '/'
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'Whatever AI Assistant Agent',
      logo: {
        alt: 'Logo',
        src: 'img/agent_logo.svg',
        srcDark: 'img/agent_logo.svg',
      },
      items: [
        {
          href: 'https://github.com/FranckyC/agents-league-whatever-ai-assistant',
          position: 'right',
          html: `
              <a style="display:flex" href="https://github.com/FranckyC/agents-league-whatever-ai-assistant" target="_blank" rel="noreferrer noopener" aria-label="Components playground">
                <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="32px" height="31px" viewBox="0 0 31 31" version="1.1">
                  <g id="surface1">
                  <path style=" stroke:none;fill-rule:evenodd;fill:rgb(14.117648%,16.078432%,18.431373%);fill-opacity:1;" d="M 15.453125 0 C 6.910156 0 0 7.105469 0 15.894531 C 0 22.917969 4.425781 28.863281 10.566406 30.96875 C 11.335938 31.128906 11.617188 30.628906 11.617188 30.207031 C 11.617188 29.839844 11.589844 28.574219 11.589844 27.261719 C 7.292969 28.207031 6.394531 25.367188 6.394531 25.367188 C 5.707031 23.523438 4.683594 23.050781 4.683594 23.050781 C 3.273438 22.078125 4.785156 22.078125 4.785156 22.078125 C 6.34375 22.183594 7.164062 23.707031 7.164062 23.707031 C 8.546875 26.128906 10.773438 25.445312 11.667969 25.023438 C 11.792969 23.996094 12.203125 23.285156 12.640625 22.890625 C 9.210938 22.523438 5.601562 21.15625 5.601562 15.050781 C 5.601562 13.3125 6.21875 11.894531 7.191406 10.789062 C 7.035156 10.394531 6.5 8.761719 7.34375 6.578125 C 7.34375 6.578125 8.648438 6.15625 11.589844 8.210938 C 12.851562 7.863281 14.148438 7.683594 15.453125 7.683594 C 16.757812 7.683594 18.089844 7.867188 19.316406 8.210938 C 22.257812 6.15625 23.5625 6.578125 23.5625 6.578125 C 24.410156 8.761719 23.871094 10.394531 23.71875 10.789062 C 24.714844 11.894531 25.304688 13.3125 25.304688 15.050781 C 25.304688 21.15625 21.695312 22.496094 18.242188 22.890625 C 18.804688 23.390625 19.292969 24.339844 19.292969 25.839844 C 19.292969 27.96875 19.265625 29.679688 19.265625 30.207031 C 19.265625 30.628906 19.546875 31.128906 20.316406 30.96875 C 26.457031 28.863281 30.882812 22.917969 30.882812 15.894531 C 30.90625 7.105469 23.972656 0 15.453125 0 Z M 15.453125 0 "/>
                  </g>
                </svg>
              </a>
            `
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
      ],
      copyright: `Copyright © Franck Cornu ${new Date().getFullYear()}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    zoom: {
      selector: '.markdown :not(em) > img',
      background: {
        light: 'rgb(255, 255, 255)',
        dark: 'rgb(50, 50, 50)'
      },
      config: {
      }
    }
  } satisfies Preset.ThemeConfig,

  plugins: [
    async function myPlugin(context, options) {
      return {
        name: "docusaurus-tailwindcss",
        configurePostCss(postcssOptions) {
          postcssOptions.plugins.push(require("tailwindcss"));
          postcssOptions.plugins.push(require("autoprefixer"));
          return postcssOptions;
        },
      };
    },
    function webpackConfig(context, options) {
      return {
        name: 'loaders',
        configureWebpack(config, isServer) {

            return {
              module: {
                rules: [               
                  {
                    test: /strings\..+(\.d\.ts|\.map)$/,
                    use: 
                      {
                        loader: 'null-loader',
                      }                  
                  }
                ],
              },
              plugins: [
                new webpack.EnvironmentPlugin({
                  ENV_SiteUrl: 'http://localhost:3000',
                  ENV_BaseUrl: '/',
                  ENV_SearchUrl: 'http://localhost:3000'
                })
              ]
            };
        }
      };
    },
    'docusaurus-plugin-image-zoom'
  ]
};

export default config;
