import React from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { StaticQuery, graphql } from 'gatsby';
import layoutStyles from './layout.module.css';

// Highlight
import hljs from 'highlight.js/lib/highlight';
import javascript from 'highlight.js/lib/languages/javascript';

import Header from './header';
hljs.registerLanguage('javascript', javascript);

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
            </Helmet>
            <Header
              className={layoutStyles.header}
              siteTitle={data.site.siteMetadata.title}
            />
            <div className={layoutStyles.sidebar}>hello</div>
            <div className={layoutStyles.content}>{children}</div>
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
