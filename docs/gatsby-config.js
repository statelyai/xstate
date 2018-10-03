module.exports = {
  pathPrefix: '/xstate',
  siteMetadata: {
    title: 'Xstate Docs'
  },
  plugins: [
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'pages',
        path: `${__dirname}/src/pages`
      }
    },
    'gatsby-plugin-react-helmet',
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: 'xstate-docs',
        short_name: 'starter',
        start_url: '/',
        background_color: '#663399',
        theme_color: '#663399',
        display: 'minimal-ui',
        icon: 'src/images/gatsby-icon.png'
      }
    },
    'gatsby-plugin-offline',
    'gatsby-plugin-sharp',
    {
      resolve: 'gatsby-mdx',
      options: {
        extensions: ['.mdx', '.md'],
        defaultLayout: require.resolve('./src/components/layout.js'),
        mdPlugins: [require('remark-toc')],
        gatsbyRemarkPlugins: [
          // {
          //   resolve: 'gatsby-remark-embedded-codesandbox',
          //   options: {
          //     directory: `${__dirname}/src/sandboxes`,
          //   },
          // },
          {
            resolve: 'gatsby-remark-images',
            options: {
              maxWidth: 1035,
              sizeByPixelDensity: true
            }
          },
          { resolve: 'gatsby-remark-autolink-headers' }
        ]
      }
    }
  ]
};
