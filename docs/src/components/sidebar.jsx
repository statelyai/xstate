import React from 'react';
import { Link, StaticQuery, graphql } from 'gatsby';

const sitemap = {
  guides: {
    actions: {},
    activities: {},
    communication: {},
    context: {},
    delays: {},
    faqs: {},
    final: {},
    guards: {},
    hierarchical: {},
    history: {},
    ids: {},
    installation: {},
    internal: {},
    interpretation: {},
    parallel: {},
    states: {},
    typescript: {}
  },
  recipes: {},
  api: {}
};

export class Sidebar extends React.Component {
  renderPages(pages, parentKey) {
    return (
      <ul>
        {Object.keys(pages).map(key => {
          return (
            <li>
              <Link to={`${parentKey}/${key}`}>{key}</Link>
            </li>
          );
        })}
      </ul>
    );
  }
  render() {
    return (
      <nav>
        <ul>
          {Object.keys(sitemap).map(key => {
            const pages = sitemap[key];

            return (
              <li>
                <Link to={`/${key}`}>{key}</Link>
                {this.renderPages(pages, key)}
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
}
