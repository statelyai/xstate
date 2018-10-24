import React from 'react';
import { Link, StaticQuery, graphql } from 'gatsby';

const sitemap = {
  guides: {
    title: 'Guides',
    pages: {
      actions: {
        title: 'Actions (Side Effects)'
      },
      activities: {
        title: 'Activities'
      },
      communication: {
        title: 'Communication (Invoking)'
      },
      context: {
        title: 'Context (Extended State)'
      },
      delays: {
        title: 'Delayed Events & Transitions'
      },
      // faqs: {
      //   title: 'FAQs'
      // },
      final: {
        title: 'Final States'
      },
      guards: {
        title: 'Guards (Conditional Transitions)'
      },
      hierarchical: {
        title: 'Hierarchical (Nested) State Nodes'
      },
      history: {
        title: 'History State Nodes'
      },
      ids: {
        title: 'Identifying States'
      },
      installation: {
        title: 'Installation'
      },
      internal: {
        title: 'Internal Transitions'
      },
      interpretation: {
        title: 'Interpreting Machines'
      },
      parallel: {
        title: 'Parallel State Nodes'
      },
      states: {
        title: 'States'
      },
      typescript: {
        title: 'TypeScript Usage'
      }
    }
  },
  examples: {
    title: 'Examples',
    pages: {
      react: {
        title: 'React'
      },
      rxjs: {
        title: 'RxJS'
      }
    }
  },
  api: {
    title: 'API Docs'
  }
};

export class Sidebar extends React.Component {
  renderPages(pages, parentKey) {
    return (
      <ul>
        {Object.keys(pages).map(key => {
          const page = pages[key];

          return (
            <li>
              <Link to={`${parentKey}/${key}`}>{page.title}</Link>
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
            const { pages, title } = sitemap[key];

            return (
              <li>
                <Link to={`/${key}`}>{title}</Link>
                {pages && this.renderPages(pages, key)}
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
}
