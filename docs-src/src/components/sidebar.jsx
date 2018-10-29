import React from 'react';
import { Link, StaticQuery, graphql } from 'gatsby';
import sidebarStyles from './sidebar.module.css';
import cn from 'classnames';

console.log(sidebarStyles);

const sitemap = {
  guides: {
    title: 'Guides',
    pages: {
      start: {
        title: 'Getting Started'
      },
      installation: {
        title: 'Installation'
      },
      states: {
        title: 'States'
      },
      transitions: {
        title: 'Transitions'
      },
      hierarchical: {
        title: 'Hierarchical States'
      },
      parallel: {
        title: 'Parallel States'
      },
      actions: {
        title: 'Actions'
      },
      guards: {
        title: 'Guards'
      },
      context: {
        title: 'Context'
      },
      activities: {
        title: 'Activities'
      },
      communication: {
        title: 'Communication'
      },
      delays: {
        title: 'Delays'
      },
      // faqs: {
      //   title: 'FAQs'
      // },
      final: {
        title: 'Final States'
      },
      history: {
        title: 'History State Nodes'
      },
      ids: {
        title: 'Identifying States'
      },

      internal: {
        title: 'Internal Transitions'
      },
      interpretation: {
        title: 'Interpreting Machines'
      },
      typescript: {
        title: 'TypeScript Usage'
      }
    }
  },
  recipes: {
    title: 'Recipes',
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
    title: 'API Docs',
    pages: {
      api: {
        title: 'TypeScript',
        link: '/docs/api'
      },
      v3: {
        title: 'Version 3.x',
        link: '/docs-v3'
      }
    }
  }
};

export class Sidebar extends React.Component {
  renderPages(pages, parentKey) {
    return (
      <ul className={sidebarStyles.items}>
        {Object.keys(pages).map(key => {
          const page = pages[key];
          const link = pages[key].link || `docs/${parentKey}/${key}`;

          return (
            <li className={sidebarStyles.item}>
              <Link to={link} className={sidebarStyles.link}>
                {page.title}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }
  render() {
    const { visible } = this.props;

    return (
      <nav className={sidebarStyles.nav}>
        <ul className={sidebarStyles.items}>
          {Object.keys(sitemap).map(key => {
            const { pages, title, link = `docs/${key}` } = sitemap[key];

            return (
              <li className={cn(sidebarStyles.item, sidebarStyles.topLevel)}>
                <Link to={link} className={sidebarStyles.link}>
                  {title}
                </Link>
                {pages && this.renderPages(pages, key)}
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
}
