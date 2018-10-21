import React from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { StaticQuery, graphql } from 'gatsby';
import { MDXProvider } from '@mdx-js/tag';
import layoutStyles from './layout.module.css';
import typeStyles from './typography.module.css';
import 'prismjs/themes/prism-okaidia.css';
import cn from 'classnames';

// Highlight
import hljs from 'highlight.js/lib/highlight';
// import javascript from 'highlight.js/lib/languages/javascript';

import Header from './header';
import { Sidebar } from './sidebar';
// hljs.registerLanguage('javascript', javascript);
// hljs.registerLanguage('typescript', typescript);

class Layout extends React.Component {
  componentDidMount() {
    hljs.initHighlighting();
  }
  render() {
    const { children } = this.props;

    return (
      <StaticQuery
        query={graphql`
          query SiteTitleQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        `}
        render={data => (
          <main className={layoutStyles.layout}>
            <Helmet
              title={data.site.siteMetadata.title}
              meta={[
                { name: 'description', content: 'Sample' },
                { name: 'keywords', content: 'sample, something' }
              ]}
            >
              <html lang="en" />
              <link
                href="https://fonts.googleapis.com/css?family=Roboto|Source+Code+Pro"
                rel="stylesheet"
              />
            </Helmet>
            <Header
              className={layoutStyles.header}
              siteTitle={data.site.siteMetadata.title}
            />
            <div className={layoutStyles.sidebar}>
              <Sidebar />
            </div>

            <MDXProvider
              components={{
                h1: props => (
                  <h1
                    className={cn(typeStyles.heading, typeStyles.h1)}
                    id={props.id}
                  >
                    {props.children}
                  </h1>
                ),
                h2: props => (
                  <h2
                    className={cn(typeStyles.heading, typeStyles.h2)}
                    id={props.id}
                  >
                    {props.children}
                  </h2>
                )
              }}
            >
              <main className={layoutStyles.content}>{children}</main>
            </MDXProvider>
          </main>
        )}
      />
    );
  }
}

Layout.propTypes = {
  children: PropTypes.node.isRequired
};

export default Layout;
